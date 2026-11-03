import "server-only";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import { generateClozeQuiz, gradeQuiz, type Passage, type QuizKey, type QuizQuestion } from "./cloze";
import { revisionSchedule, topicProgress, type GradedAnswer, type RevisionItem, type TopicProgress } from "./revision";

export type PublicQuestion = Omit<QuizQuestion, "term">;
export type QuizSummary = { id: string; courseId: string; title: string; topic: string; createdAt: string; questionCount: number; latestScore: number | null; attempts: number };
export type QuizResult = { scorePercent: number; results: ReturnType<typeof gradeQuiz>["results"]; weakTerms: string[]; attemptId: string };

async function passagesFor(supabase: ServerSupabase, courseId: string, topic: string | null): Promise<Passage[]> {
  if (topic) {
    const { data, error } = await supabase.rpc("search_course_chunks", { p_course_id: courseId, p_query: topic, p_limit: 6 });
    if (error) throw fromDbError(error);
    return (data ?? []).map((r) => ({ chunkId: r.chunk_id, documentId: r.document_id, filename: r.filename, page: r.page_start, content: r.content }));
  }
  const { data, error } = await supabase
    .from("document_chunks")
    .select("id, document_id, page_start, content, documents!inner(filename, status)")
    .eq("course_id", courseId)
    .eq("documents.status", "ready")
    .order("chunk_index")
    .limit(60);
  if (error) throw fromDbError(error);
  return data.map((r) => ({ chunkId: r.id, documentId: r.document_id, filename: (r.documents as unknown as { filename: string }).filename, page: r.page_start, content: r.content }));
}

/** Generates a grounded quiz from the student's own passages. Keys are stored server-only. */
export async function createQuiz(deps: { supabase: ServerSupabase; admin: AdminSupabase; userId: string; courseId: string; topic: string | null; focusTerms?: string[] }) {
  const { supabase, admin, userId, courseId, focusTerms } = deps;
  // An adaptive retest searches for and blanks the concepts the student missed.
  const topic = focusTerms?.length ? focusTerms.join(" ") : deps.topic;
  const { data: course } = await supabase.from("courses").select("id, title").eq("id", courseId).maybeSingle();
  if (!course) throw new ApiError(404, "not_found", "Course not found.");
  const passages = await passagesFor(supabase, courseId, topic);
  const seed = crypto.randomUUID();
  const { questions, keys } = generateClozeQuiz(passages, { seed, count: 5, focusTerms });
  if (questions.length < 3) {
    throw new ApiError(409, "not_enough_material", topic ? "Not enough matching material for that topic. Try a broader topic or upload more notes." : "Upload and index more text-based notes to generate a check.");
  }
  const publicQuestions: PublicQuestion[] = questions.map(({ id, prompt, options, evidence }) => ({ id, prompt, options, evidence }));
  const { data: quiz, error } = await admin
    .from("quizzes")
    .insert({ owner_id: userId, course_id: courseId, title: `${course.title} knowledge check`, topic: focusTerms?.length ? `Review: ${focusTerms.join(", ")}`.slice(0, 160) : (topic ?? "Whole course"), questions: publicQuestions as unknown as Json })
    .select("id, created_at")
    .single();
  if (error) throw fromDbError(error);
  const fullKeys = keys.map((k) => ({ ...k, term: questions.find((q) => q.id === k.questionId)!.term }));
  const keyInsert = await admin.from("quiz_keys").insert({ quiz_id: quiz.id, owner_id: userId, keys: fullKeys as unknown as Json });
  if (keyInsert.error) {
    await admin.from("quizzes").delete().eq("id", quiz.id).eq("owner_id", userId);
    throw fromDbError(keyInsert.error);
  }
  return { id: quiz.id, title: `${course.title} knowledge check`, topic: focusTerms?.length ? `Review: ${focusTerms.join(", ")}`.slice(0, 160) : (topic ?? "Whole course"), questions: publicQuestions, createdAt: quiz.created_at };
}

export async function getQuiz(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase.from("quizzes").select("id, course_id, title, topic, questions, created_at").eq("id", id).single();
  if (error) throw fromDbError(error, "Quiz not found.");
  return { id: data.id, courseId: data.course_id, title: data.title, topic: data.topic, questions: data.questions as unknown as PublicQuestion[], createdAt: data.created_at };
}

export async function listQuizzes(supabase: ServerSupabase): Promise<QuizSummary[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, course_id, title, topic, created_at, questions, quiz_attempts(score_percent, created_at)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw fromDbError(error);
  return data.map((q) => {
    const attempts = [...(q.quiz_attempts ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      id: q.id,
      courseId: q.course_id,
      title: q.title,
      topic: q.topic,
      createdAt: q.created_at,
      questionCount: Array.isArray(q.questions) ? q.questions.length : 0,
      latestScore: attempts[0] ? Number(attempts[0].score_percent) : null,
      attempts: attempts.length,
    };
  });
}

/** Grades on the server with keys the browser never received, then records the attempt. */
export async function submitQuiz(deps: { supabase: ServerSupabase; admin: AdminSupabase; userId: string; quizId: string; answers: number[] }): Promise<QuizResult> {
  const quiz = await getQuiz(deps.supabase, deps.quizId);
  if (deps.answers.length !== quiz.questions.length) throw new ApiError(400, "invalid_input", "Answer every question.");
  const { data: keyRow, error } = await deps.admin.from("quiz_keys").select("keys").eq("quiz_id", quiz.id).eq("owner_id", deps.userId).single();
  if (error) throw fromDbError(error, "Quiz not found.");
  const keys = keyRow.keys as unknown as (QuizKey & { term: string })[];
  const questions: QuizQuestion[] = quiz.questions.map((q) => ({ ...q, term: keys.find((k) => k.questionId === q.id)!.term }));
  const graded = gradeQuiz(questions, keys, deps.answers);
  const { data: attempt, error: aErr } = await deps.admin
    .from("quiz_attempts")
    .insert({ owner_id: deps.userId, quiz_id: quiz.id, answers: deps.answers as unknown as Json, results: graded.results as unknown as Json, score_percent: graded.scorePercent })
    .select("id")
    .single();
  if (aErr) throw fromDbError(aErr);
  return { ...graded, attemptId: attempt.id };
}

export type PracticeEvidence = { revision: RevisionItem[]; progress: TopicProgress[] };

/** Spaced-revision queue and baseline-vs-latest progress, derived only from the student's graded attempts. */
export async function getPracticeEvidence(supabase: ServerSupabase, now: number): Promise<PracticeEvidence> {
  const { data, error } = await supabase.from("quiz_attempts").select("results, score_percent, created_at, quizzes(course_id, topic)").order("created_at").limit(300);
  if (error) throw fromDbError(error);
  const answers: GradedAnswer[] = [];
  const attempts: { courseId: string; topic: string; score: number; at: string }[] = [];
  for (const row of data) {
    const quiz = row.quizzes as unknown as { course_id: string; topic: string } | null;
    if (!quiz) continue;
    attempts.push({ courseId: quiz.course_id, topic: quiz.topic, score: Number(row.score_percent), at: row.created_at });
    for (const r of (Array.isArray(row.results) ? row.results : []) as { term?: string; correct?: boolean }[]) {
      if (typeof r?.term === "string" && typeof r.correct === "boolean") answers.push({ term: r.term, correct: r.correct, at: row.created_at, courseId: quiz.course_id });
    }
  }
  return { revision: revisionSchedule(answers, now), progress: topicProgress(attempts) };
}
