import "server-only";
import { getCatchupPack } from "@/lib/catchup/service";
import { ApiError, fromDbError } from "@/lib/http/errors";
import { logEvent } from "@/lib/observability/log";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import { bridge, DIFFICULTY, statusFor, updateRating, type Confidence, type MasteryStatus } from "./elo";
import { clozeItem, screenConcepts, validateItem, type ConceptSource, type ItemDraft } from "./items";
import { runSpecialist, type SpecialistName } from "./specialists";

/**
 * Diagnostician and Quizmaster flows. The agents only write questions from the student's own pages; every
 * question is validated against its page (or replaced by a deterministic fill-the-gap question), answer keys stay
 * server-side, and ratings and statuses are computed in code (elo.ts).
 */
export type AssessmentMode = "diagnostic" | "practice" | "rehearsal";
export type PublicItem = { id: string; position: number; concept: string; page: number; prompt: string; options: string[]; source: "agent" | "cloze"; timeLimitSeconds: number | null };
export type MasteryConcept = { concept: string; page: number; quote: string; status: MasteryStatus; attempts: number; correct: number };
export type MasteryMap = { documentId: string; filename: string; concepts: MasteryConcept[]; bridge: MasteryConcept[]; tested: number };
export type SessionInfo = { sessionId: string; mode: AssessmentMode; items: PublicItem[]; agent: { name: "Diagnostician" | "Quizmaster"; model: string | null; runId: string | null; agentWritten: number; fallback: number } };

const MAX_CONCEPTS = 6;
const REHEARSAL_SECONDS = 45;

type Deps = { supabase: ServerSupabase; admin: AdminSupabase; userId: string };

async function packConcepts(supabase: ServerSupabase, documentId: string) {
  const { pack, filename, courseId } = await getCatchupPack(supabase, documentId);
  // Lecture text is untrusted: a passage that reads like instructions to an AI is never turned into a question.
  const { safe, flagged } = screenConcepts(pack.keyTerms.map((t): ConceptSource => ({ concept: t.term, page: t.page, quote: t.quote })));
  if (flagged.length) logEvent("warn", "mastery.concepts_flagged", { documentId, flagged: flagged.length });
  const concepts = safe.slice(0, MAX_CONCEPTS);
  return { concepts, terms: safe.map((t) => t.concept), filename, courseId };
}

async function ensureMasteryRows(admin: AdminSupabase, userId: string, documentId: string, concepts: ConceptSource[]) {
  const rows = concepts.map((c) => ({ owner_id: userId, document_id: documentId, concept: c.concept, page: c.page, quote: c.quote.slice(0, 1200) }));
  const { error } = await admin.from("concept_mastery").upsert(rows, { onConflict: "owner_id,document_id,concept", ignoreDuplicates: true });
  if (error) throw fromDbError(error);
}

/** Validated agent questions per concept (up to `perConcept`), each falling back to a fill-the-gap question. */
function chooseItems(concepts: ConceptSource[], drafts: ItemDraft[], terms: string[], perConcept: number, seed: string) {
  const chosen: { draft: ItemDraft; source: "agent" | "cloze"; quote: string }[] = [];
  for (const c of concepts) {
    const valid = drafts.filter((d) => d.concept.trim().toLowerCase() === c.concept.toLowerCase() && validateItem({ ...d, page: Math.trunc(d.page) }, c).ok).slice(0, perConcept);
    for (const d of valid) chosen.push({ draft: { ...d, concept: c.concept }, source: "agent", quote: c.quote });
    if (!valid.length) {
      const cloze = clozeItem(c, terms, seed);
      if (cloze) chosen.push({ draft: cloze, source: "cloze", quote: c.quote });
    }
  }
  return chosen;
}

async function storeSession(deps: Deps & { documentId: string; mode: AssessmentMode; items: { draft: ItemDraft; source: "agent" | "cloze"; quote: string }[]; timeLimitSeconds: number | null }): Promise<{ sessionId: string; items: PublicItem[] }> {
  const sessionId = crypto.randomUUID();
  const rows = deps.items.map((it, position) => ({
    owner_id: deps.userId,
    document_id: deps.documentId,
    session_id: sessionId,
    mode: deps.mode,
    position,
    concept: it.draft.concept,
    page: it.draft.page,
    prompt: it.draft.prompt.slice(0, 600),
    options: it.draft.options as unknown as Json,
    difficulty: DIFFICULTY[it.draft.difficulty] ?? 0,
    source: it.source,
    time_limit_seconds: deps.timeLimitSeconds,
  }));
  const { data, error } = await deps.admin.from("assessment_items").insert(rows).select("id, position, concept, page, prompt, options, source, time_limit_seconds");
  if (error) throw fromDbError(error);
  const keys = data.map((row) => {
    const it = deps.items[row.position];
    return { item_id: row.id, owner_id: deps.userId, answer_index: it.draft.answerIndex, hint: it.draft.hint.slice(0, 400), quote: it.quote.slice(0, 1200) };
  });
  const keyInsert = await deps.admin.from("assessment_keys").insert(keys);
  if (keyInsert.error) {
    await deps.admin.from("assessment_items").delete().eq("session_id", sessionId).eq("owner_id", deps.userId);
    throw fromDbError(keyInsert.error);
  }
  const items = data
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ id: r.id, position: r.position, concept: r.concept, page: r.page, prompt: r.prompt, options: r.options as string[], source: r.source as "agent" | "cloze", timeLimitSeconds: r.time_limit_seconds }));
  return { sessionId, items };
}

async function runAndStore(deps: Deps & { documentId: string; courseId: string; agent: SpecialistName; mode: AssessmentMode; concepts: ConceptSource[]; terms: string[]; perConcept: number; timeLimitSeconds: number | null }): Promise<SessionInfo> {
  const generated = await runSpecialist({ admin: deps.admin, userId: deps.userId, courseId: deps.courseId, agent: deps.agent, concepts: deps.concepts, perConcept: deps.perConcept });
  const chosen = chooseItems(deps.concepts, generated.drafts, deps.terms, deps.perConcept, deps.documentId);
  if (chosen.length < 2) throw new ApiError(409, "not_enough_material", "There isn't enough text in this lecture to build questions. Upload a text-based PDF with a few pages of notes.");
  const { sessionId, items } = await storeSession({ ...deps, items: chosen });
  const agentWritten = chosen.filter((c) => c.source === "agent").length;
  return { sessionId, mode: deps.mode, items, agent: { name: deps.agent === "diagnostician" ? "Diagnostician" : "Quizmaster", model: generated.model, runId: generated.runId, agentWritten, fallback: chosen.length - agentWritten } };
}

/** Diagnostician: a 3-minute warm-up, one question per key concept of the lecture (at most 6). */
export async function startDiagnostic(deps: Deps & { documentId: string }): Promise<SessionInfo> {
  const { concepts, terms, courseId } = await packConcepts(deps.supabase, deps.documentId);
  if (concepts.length < 2) throw new ApiError(409, "not_enough_material", "There isn't enough text in this lecture to build a warm-up yet.");
  await ensureMasteryRows(deps.admin, deps.userId, deps.documentId, concepts);
  return runAndStore({ ...deps, courseId, agent: "diagnostician", mode: "diagnostic", concepts, terms, perConcept: 1, timeLimitSeconds: null });
}

/** Quizmaster: practice on the gaps (or timed rehearsal on known concepts, opt-in). */
export async function startPractice(deps: Deps & { documentId: string; mode: "practice" | "rehearsal" }): Promise<SessionInfo> {
  const map = await getMasteryMap(deps.supabase, deps.documentId);
  if (!map.tested) throw new ApiError(409, "warmup_first", "Take the 3-minute warm-up first, so practice can target what you don't know yet.");
  const { terms, courseId } = await packConcepts(deps.supabase, deps.documentId);
  const known = map.concepts.filter((c) => c.status === "known");
  if (deps.mode === "rehearsal" && !known.length) throw new ApiError(409, "rehearsal_locked", "Timed exam rehearsal opens once at least one concept is known. Practise your gaps first.");
  const targets = deps.mode === "rehearsal" ? known : (map.bridge.length ? map.bridge : map.concepts).slice(0, 3);
  const concepts = targets.map((c) => ({ concept: c.concept, page: c.page, quote: c.quote }));
  return runAndStore({ ...deps, courseId, agent: "quizmaster", mode: deps.mode, concepts, terms, perConcept: 2, timeLimitSeconds: deps.mode === "rehearsal" ? REHEARSAL_SECONDS : null });
}

async function ownItem(supabase: ServerSupabase, itemId: string) {
  const { data, error } = await supabase.from("assessment_items").select("id, document_id, concept, page, difficulty, mode, time_limit_seconds, created_at").eq("id", itemId).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError(404, "not_found", "Question not found.");
  return data;
}

async function serverKey(admin: AdminSupabase, userId: string, itemId: string) {
  const { data, error } = await admin.from("assessment_keys").select("answer_index, hint, quote").eq("item_id", itemId).eq("owner_id", userId).single();
  if (error) throw fromDbError(error);
  return data;
}

async function answered(admin: AdminSupabase, userId: string, itemId: string) {
  const { data } = await admin.from("assessment_attempts").select("id").eq("item_id", itemId).eq("owner_id", userId).maybeSingle();
  return Boolean(data);
}

/** Hint 1 is the agent's hint; hint 2 shows the page's sentence with the answer blanked. Never after answering. */
export async function takeHint(deps: Deps & { itemId: string; level: 1 | 2 }): Promise<{ level: 1 | 2; hint: string }> {
  const item = await ownItem(deps.supabase, deps.itemId);
  if (await answered(deps.admin, deps.userId, deps.itemId)) throw new ApiError(409, "already_answered", "You've already answered this question.");
  if (item.mode === "rehearsal") throw new ApiError(409, "no_hints_in_rehearsal", "Exam rehearsal has no hints.");
  const key = await serverKey(deps.admin, deps.userId, deps.itemId);
  const { data: itemRow } = await deps.admin.from("assessment_items").select("options").eq("id", deps.itemId).eq("owner_id", deps.userId).single();
  const options = (itemRow?.options as string[] | undefined) ?? [];
  let hint = key.hint;
  if (deps.level === 2) {
    let blanked = key.quote;
    for (const secret of [options[key.answer_index], item.concept].filter(Boolean)) {
      const escaped = secret!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\.\\\.\\\.$/, "");
      blanked = blanked.replace(new RegExp(escaped.length > 3 ? escaped : `\\b${escaped}\\b`, "gi"), "_____");
    }
    hint = `Page ${item.page} says: "${blanked}"`;
  }
  await deps.admin.from("assessment_hints").upsert({ item_id: deps.itemId, owner_id: deps.userId, level: deps.level }, { onConflict: "item_id,level", ignoreDuplicates: true });
  return { level: deps.level, hint };
}

export type AnswerResult = { correct: boolean; answerIndex: number; timedOut: boolean; explanation: { page: number; quote: string }; mastery: { concept: string; status: MasteryStatus } };

/** Grades one answer (once), records it and updates the concept's rating and status. */
export async function answerItem(deps: Deps & { itemId: string; chosen: number | null; confidence: Confidence; elapsedMs: number; now?: number }): Promise<AnswerResult> {
  const item = await ownItem(deps.supabase, deps.itemId);
  const key = await serverKey(deps.admin, deps.userId, deps.itemId);
  const now = deps.now ?? Date.now();
  // A timed question answered after its limit (plus 5 s for the network) counts as timed out.
  const limitMs = item.time_limit_seconds ? (item.time_limit_seconds + 5) * 1000 : null;
  const timedOut = deps.chosen === null || (limitMs !== null && deps.elapsedMs > limitMs);
  const correct = !timedOut && deps.chosen === key.answer_index;
  const { count: hintsUsed } = await deps.admin.from("assessment_hints").select("level", { count: "exact", head: true }).eq("item_id", deps.itemId).eq("owner_id", deps.userId);
  // Hints and timeouts never earn full credit, and a timeout is never "confidently wrong".
  const confidence: Confidence = timedOut || (hintsUsed ?? 0) > 0 ? "guess" : deps.confidence;
  const attempt = await deps.admin.from("assessment_attempts").insert({
    owner_id: deps.userId,
    item_id: deps.itemId,
    chosen: timedOut ? null : deps.chosen,
    correct,
    confidence: deps.confidence,
    elapsed_ms: Math.max(0, Math.min(Math.round(deps.elapsedMs), 3_600_000)),
    hints_used: Math.min(2, hintsUsed ?? 0),
    timed_out: timedOut,
  });
  if (attempt.error?.code === "23505") throw new ApiError(409, "already_answered", "You've already answered this question.");
  if (attempt.error) throw fromDbError(attempt.error);

  const { data: m, error } = await deps.admin.from("concept_mastery").select("id, rating, attempts, correct").eq("owner_id", deps.userId).eq("document_id", item.document_id).eq("concept", item.concept).single();
  if (error) throw fromDbError(error);
  const next = updateRating({ rating: m.rating, attempts: m.attempts }, { difficulty: item.difficulty }, { correct, confidence });
  const lastConfidentWrong = !correct && !timedOut && confidence === "sure";
  const correctCount = m.correct + (correct ? 1 : 0);
  const status = statusFor({ ...next, correct: correctCount, lastConfidentWrong });
  const update = await deps.admin
    .from("concept_mastery")
    .update({ rating: next.rating, attempts: next.attempts, correct: correctCount, last_confident_wrong: lastConfidentWrong, status, updated_at: new Date(now).toISOString() })
    .eq("id", m.id)
    .eq("owner_id", deps.userId);
  if (update.error) throw fromDbError(update.error);
  return { correct, answerIndex: key.answer_index, timedOut, explanation: { page: item.page, quote: key.quote }, mastery: { concept: item.concept, status } };
}

/** Where the student is (per concept) and the bridge to where they need to be (every concept known). */
export async function getMasteryMap(supabase: ServerSupabase, documentId: string): Promise<MasteryMap> {
  const { data: doc } = await supabase.from("documents").select("id, filename").eq("id", documentId).maybeSingle();
  if (!doc) throw new ApiError(404, "not_found", "Document not found.");
  const { data, error } = await supabase.from("concept_mastery").select("concept, page, quote, status, attempts, correct").eq("document_id", documentId).order("page").order("concept");
  if (error) throw fromDbError(error);
  const concepts = data.map((c) => ({ ...c, status: c.status as MasteryStatus }));
  return { documentId, filename: doc.filename, concepts, bridge: bridge(concepts), tested: concepts.filter((c) => c.status !== "untested").length };
}

/** An unfinished session (e.g. one the Coach asked the Quizmaster to prepare), with only the unanswered questions. */
export async function getSession(supabase: ServerSupabase, sessionId: string): Promise<SessionInfo | null> {
  const { data: items, error } = await supabase.from("assessment_items").select("id, position, concept, page, prompt, options, source, time_limit_seconds, mode").eq("session_id", sessionId).order("position");
  if (error) throw fromDbError(error);
  if (!items?.length) return null;
  const { data: attempts } = await supabase.from("assessment_attempts").select("item_id").in("item_id", items.map((i) => i.id));
  const done = new Set((attempts ?? []).map((a) => a.item_id));
  const open = items.filter((i) => !done.has(i.id));
  if (!open.length) return null;
  const mode = items[0].mode as AssessmentMode;
  const agentWritten = items.filter((i) => i.source === "agent").length;
  return {
    sessionId,
    mode,
    items: open.map((r) => ({ id: r.id, position: r.position, concept: r.concept, page: r.page, prompt: r.prompt, options: r.options as string[], source: r.source as "agent" | "cloze", timeLimitSeconds: r.time_limit_seconds })),
    agent: { name: mode === "diagnostic" ? "Diagnostician" : "Quizmaster", model: null, runId: null, agentWritten, fallback: items.length - agentWritten },
  };
}
