import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarClock, CheckCircle2, FileText } from "lucide-react";
import Landscape from "@/components/nature/landscape";
import CourseDialog from "@/components/features/courses/course-dialog";
import SyllabusImport from "@/components/features/courses/syllabus-import";
import PageHeading from "@/components/ui/page-heading";
import { Chip, EmptyCard } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/db/assignments";
import { listCourses } from "@/lib/db/courses";
import { listDocuments } from "@/lib/db/documents";
import { getProfile } from "@/lib/db/profiles";
import { renderTime } from "@/lib/server/clock";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Knowledge vault" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ import?: string }> }) {
  const { supabase, user } = await requirePageUser("/courses");
  const [courses, documents, assignments, profile, params, now] = await Promise.all([
    listCourses(supabase),
    listDocuments(supabase),
    listAssignments(supabase),
    getProfile(supabase, user.id),
    searchParams,
    renderTime(),
  ]);
  const tz = profile.timezone;
  const recent = [...documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const titles = Object.fromEntries(courses.map((c) => [c.id, c.title]));

  return (
    <>
      <PageHeading
        eyebrow="Your evidence library"
        title="Knowledge,"
        accent="beautifully connected."
        description="Documents are stored privately, split into page-referenced passages and only ever searched on your behalf. Answers cite the pages they came from."
        actions={
          <>
            <SyllabusImport courses={courses.map((c) => ({ id: c.id, title: c.title }))} timezone={tz} defaultOpen={params.import === "syllabus"} />
            <CourseDialog small />
          </>
        }
      />
      {courses.length === 0 ? (
        <EmptyCard icon={BookOpen} title="Plant your first course" action={<CourseDialog triggerLabel="Create your first course" small />}>
          Create a course to add assignments and upload text-based PDF notes, or import a syllabus to pull in its deadlines.
        </EmptyCard>
      ) : (
        <>
          <ul className="vault-cards" aria-label="Courses">
            {courses.map((course) => {
              const docs = documents.filter((d) => d.courseId === course.id);
              const ready = docs.filter((d) => d.status === "ready").length;
              const next = assignments
                .filter((a) => a.courseId === course.id && a.status !== "completed" && Date.parse(a.dueAt) > now)
                .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))[0];
              return (
                <li key={course.id} className="card vault-course">
                  <div className="vault-art" aria-hidden="true"><Landscape /></div>
                  <Link href={`/courses/${course.id}`} className="vault-course-body">
                    <strong>{course.title}</strong>
                    <span>{course.assignmentCount} assignment{course.assignmentCount === 1 ? "" : "s"} · {course.documentCount} document{course.documentCount === 1 ? "" : "s"}</span>
                    <div className="microbar" aria-hidden="true"><span style={{ width: `${docs.length ? (ready / docs.length) * 100 : 0}%`, background: "var(--chart-1)" }} /></div>
                    <span className="vault-meta">
                      <span>{docs.length ? `${ready}/${docs.length} indexed` : "No documents yet"}</span>
                      <span><CalendarClock className="ic" aria-hidden="true" /> {next ? `${next.title} · ${formatDateTime(next.dueAt, tz, { hour: undefined, minute: undefined })}` : "No upcoming deadline"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <section className="card card-inner section-space" aria-labelledby="recent-docs">
            <div className="split-head"><h3 id="recent-docs">Recent documents</h3><Chip>{documents.filter((d) => d.status === "ready").length} indexed</Chip></div>
            {recent.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>No documents yet. Open a course to upload notes, or import a syllabus.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {recent.map((d) => (
                  <li key={d.id} className="task-item">
                    <span style={{ minWidth: 0 }}>
                      <FileText className="ic" aria-hidden="true" />
                      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <Link href={`/courses/${d.courseId}#documents`} style={{ overflowWrap: "anywhere", fontWeight: 700 }}>{d.filename}</Link>
                        <span className="muted" style={{ fontSize: 10.5 }}>{titles[d.courseId] ?? "Course"} · {formatDateTime(d.createdAt, tz)}</span>
                      </span>
                    </span>
                    {d.status === "ready" ? <Chip tone="good"><CheckCircle2 className="ic" aria-hidden="true" style={{ width: 12, height: 12 }} /> Indexed · {d.pageCount} p.</Chip> : d.status === "failed" ? <Chip tone="danger">Failed</Chip> : <Chip tone="warn">Processing</Chip>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
