import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileText } from "lucide-react";
import CourseDialog from "@/components/features/courses/course-dialog";
import PageHeading from "@/components/ui/page-heading";
import { EmptyCard } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/db/courses";

export const metadata: Metadata = { title: "Knowledge vault" };

const ACCENTS = ["var(--aqua)", "var(--violet)", "var(--coral)", "var(--accent)"];

export default async function CoursesPage() {
  const { supabase } = await requirePageUser("/courses");
  const courses = await listCourses(supabase);
  return (
    <>
      <PageHeading
        eyebrow="Your evidence library"
        title="Knowledge,"
        accent="beautifully connected."
        accentColor="violet"
        description="Documents are stored privately, split into page-referenced passages and only ever searched on your behalf. Answers cite the pages they came from."
        actions={<CourseDialog small />}
      />
      {courses.length === 0 ? (
        <EmptyCard icon={BookOpen} title="No courses yet" action={<CourseDialog triggerLabel="Create your first course" small />}>
          Create a course to add assignments and upload text-based PDF notes.
        </EmptyCard>
      ) : (
        <ul className="vault-grid" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Courses">
          {courses.map((course, i) => (
            <li key={course.id} className="card vault-card">
              <Link href={`/courses/${course.id}`} className="vault-heading" style={{ textDecoration: "none" }}>
                <div className="file-icon" style={{ color: ACCENTS[i % ACCENTS.length] }}><FileText className="ic" aria-hidden="true" /></div>
                <div>
                  <strong>{course.title}</strong>
                  <p>{course.assignmentCount} assignment{course.assignmentCount === 1 ? "" : "s"} · {course.documentCount} document{course.documentCount === 1 ? "" : "s"}</p>
                </div>
              </Link>
              {course.description ? <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.7 }}>{course.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
