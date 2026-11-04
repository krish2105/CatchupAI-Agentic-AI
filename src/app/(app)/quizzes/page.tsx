import type { Metadata } from "next";
import PracticeArena from "@/components/features/quiz/practice-arena";
import PageHeading from "@/components/ui/page-heading";
import { requirePageUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/db/courses";
import { listDocuments } from "@/lib/db/documents";
import { getPracticeEvidence, listQuizzes } from "@/lib/quiz/service";
import { renderTime } from "@/lib/server/clock";
import { listTeachBack } from "@/lib/teach/service";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Practice arena" };

export default async function QuizzesPage({ searchParams }: { searchParams: Promise<{ quiz?: string }> }) {
  const { supabase } = await requirePageUser("/quizzes");
  const requested = (await searchParams).quiz;
  const openQuizId = requested && uuid.safeParse(requested).success ? requested : null;
  const now = await renderTime();
  const [courses, documents, quizzes, evidence, teachHistory] = await Promise.all([listCourses(supabase), listDocuments(supabase), listQuizzes(supabase), getPracticeEvidence(supabase, now), listTeachBack(supabase)]);
  const ready = new Set(documents.filter((d) => d.status === "ready").map((d) => d.courseId));
  return (
    <>
      <PageHeading
        eyebrow="Low pressure / high learning"
        title="Practice makes"
        accent="progress visible."
       
        description="Explain topics in your own words and take short knowledge checks built only from your uploaded material, with the source page for every concept. Graded on the server; every attempt is saved."
      />
      <PracticeArena courses={courses.map((c) => ({ id: c.id, title: c.title, ready: ready.has(c.id) }))} quizzes={quizzes} revision={evidence.revision} progress={evidence.progress} teachHistory={teachHistory} openQuizId={openQuizId} />
    </>
  );
}
