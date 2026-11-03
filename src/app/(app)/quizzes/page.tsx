import type { Metadata } from "next";
import PracticeArena from "@/components/features/quiz/practice-arena";
import PageHeading from "@/components/ui/page-heading";
import { requirePageUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/db/courses";
import { listDocuments } from "@/lib/db/documents";
import { getPracticeEvidence, listQuizzes } from "@/lib/quiz/service";
import { renderTime } from "@/lib/server/clock";

export const metadata: Metadata = { title: "Practice arena" };

export default async function QuizzesPage() {
  const { supabase } = await requirePageUser("/quizzes");
  const now = await renderTime();
  const [courses, documents, quizzes, evidence] = await Promise.all([listCourses(supabase), listDocuments(supabase), listQuizzes(supabase), getPracticeEvidence(supabase, now)]);
  const ready = new Set(documents.filter((d) => d.status === "ready").map((d) => d.courseId));
  return (
    <>
      <PageHeading
        eyebrow="Low pressure / high learning"
        title="Practice makes"
        accent="progress visible."
        accentColor="coral"
        description="Short knowledge checks built only from passages in your uploaded material, with the source page shown after each answer. Graded on the server; every attempt is saved."
      />
      <PracticeArena courses={courses.map((c) => ({ id: c.id, title: c.title, ready: ready.has(c.id) }))} quizzes={quizzes} revision={evidence.revision} progress={evidence.progress} />
    </>
  );
}
