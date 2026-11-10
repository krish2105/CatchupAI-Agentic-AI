import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { briefStudent, latestBrief, runNightCoach } from "@/lib/coach/night";
import { answerItem, startDiagnostic } from "@/lib/mastery/service";
import { processDocument } from "@/lib/rag/ingest";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let docA: string;

const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("night-a"), signedInUser("night-b")]);
  const course = (await a.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single()).data!.id;
  await a.db.from("assignments").insert({ course_id: course, title: "Regression worksheet", due_at: inDays(2), estimated_minutes: 90 });
  const bytes = new Uint8Array(readFileSync("tests/fixtures/statistics_module_4.pdf"));
  const doc = await a.db.from("documents").insert({ course_id: course, filename: "module4.pdf", size_bytes: bytes.byteLength }).select("id, storage_path").single();
  await a.db.storage.from("course-documents").upload(doc.data!.storage_path!, bytes, { contentType: "application/pdf" });
  await processDocument({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, documentId: doc.data!.id, embedder: null });
  docA = doc.data!.id;
});

beforeEach(() => {
  vi.stubEnv("CATCHUP_TEST_MODEL", "scripted");
  vi.stubEnv("OPENAI_API_KEY", "");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("Night Coach", () => {
  it("leaves a morning brief from the student's own data and records its run step by step", async () => {
    const brief = await briefStudent({ admin: adminDb(), ownerId: a.id, now: Date.now() });
    expect(brief).not.toBeNull();
    const kinds = brief!.cards.map((c) => c.kind);
    expect(kinds).toContain("deadline");
    expect(kinds).toContain("warmup");
    expect(brief!.cards.find((c) => c.kind === "deadline")!.title).toContain("Regression worksheet");
    expect(brief!.cards.find((c) => c.kind === "warmup")!.href).toBe(`/catch-up?doc=${docA}`);
    const run = await a.db.from("agent_runs").select("agent, status, tool_events").eq("id", brief!.runId!).single();
    expect(run.data).toMatchObject({ agent: "night_coach", status: "completed" });
    expect((run.data!.tool_events as { tool: string }[]).map((e) => e.tool)).toEqual(["read_checkin", "check_deadlines", "find_unchecked_lecture", "ask_quizmaster", "plan_growth"]);
    // Nothing is saved for the student: no plan, no proposal.
    expect((await a.db.from("study_plans").select("id")).data).toEqual([]);
  });

  it("once there are gaps, asks the Quizmaster to prepare practice overnight", async () => {
    const warmup = await startDiagnostic({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, documentId: docA });
    const key = async (id: string) => (await admin().from("assessment_keys").select("answer_index").eq("item_id", id).single()).data!.answer_index;
    for (const item of warmup.items) await answerItem({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, itemId: item.id, chosen: ((await key(item.id)) + 1) % 4, confidence: "sure", elapsedMs: 4000 });
    const brief = await briefStudent({ admin: adminDb(), ownerId: a.id, now: Date.now(), replace: true });
    const practice = brief!.cards.find((c) => c.kind === "practice");
    expect(practice).toMatchObject({ agent: "Quizmaster" });
    expect(practice!.href).toMatch(new RegExp(`^/catch-up\\?doc=${docA}&session=[0-9a-f-]{36}$`));
    const runs = await a.db.from("agent_runs").select("agent").eq("agent", "quizmaster");
    expect(runs.data!.length).toBeGreaterThan(0);
    expect((await latestBrief(asServer(a.db), Date.now()))?.id).toBe(brief!.id);
  });

  it("runs once per student per day, and skips students who turned check-ins off", async () => {
    expect(await briefStudent({ admin: adminDb(), ownerId: a.id, now: Date.now() })).toBeNull();
    await admin().from("notification_prefs").upsert({ owner_id: b.id, proactive_checkin: false }, { onConflict: "owner_id" });
    const course = (await b.db.from("courses").insert({ title: "Biology" }).select("id").single()).data!.id;
    // b has no plan; a ready lecture row makes the job consider b.
    await admin().from("documents").insert({ owner_id: b.id, course_id: course, filename: "bio.pdf", size_bytes: 10, status: "ready" });
    const result = await runNightCoach({ admin: adminDb(), now: Date.now(), ownerIds: [a.id, b.id] });
    expect(result).toMatchObject({ available: true, considered: 2, briefed: 0, skipped: 2, failed: 0 });
    expect((await admin().from("coach_briefs").select("id").eq("owner_id", b.id)).data).toEqual([]);
  });

  it("one student can't read or dismiss another student's brief", async () => {
    const mine = (await admin().from("coach_briefs").select("id").eq("owner_id", a.id).single()).data!;
    expect((await b.db.from("coach_briefs").select("id")).data).toEqual([]);
    await b.db.from("coach_briefs").delete().eq("id", mine.id);
    expect((await admin().from("coach_briefs").select("id").eq("id", mine.id)).data).toHaveLength(1);
    const forged = await b.db.from("coach_briefs").insert({ owner_id: b.id, brief_on: "2026-01-01", cards: [] });
    expect(forged.error).not.toBeNull();
  });
});
