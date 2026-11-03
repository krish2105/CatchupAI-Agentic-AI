import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AssignmentsPanel from "@/components/features/courses/assignments-panel";
import CourseDialog from "@/components/features/courses/course-dialog";
import DeleteCourse from "@/components/features/courses/delete-course";
import DocumentsPanel from "@/components/features/courses/documents-panel";
import EvidenceSearch from "@/components/features/courses/evidence-search";
import PageHeading from "@/components/ui/page-heading";
import { requirePageUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/db/assignments";
import { listChecklists } from "@/lib/db/checklist";
import { getCourse } from "@/lib/db/courses";
import { listDocuments } from "@/lib/db/documents";
import { getProfile } from "@/lib/db/profiles";
import { ApiError } from "@/lib/http/errors";
import { uuid } from "@/lib/validation/common";
import { renderTime } from "@/lib/server/clock";

export const metadata: Metadata = { title: "Course" };

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { supabase, user } = await requirePageUser(`/courses/${id}`);
  const course = await getCourse(supabase, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const [assignments, profile, documents] = await Promise.all([listAssignments(supabase, { courseId: id }), getProfile(supabase, user.id), listDocuments(supabase, id)]);
  const now = await renderTime();
  const checklists = await listChecklists(supabase, assignments.map((a) => a.id));
  const briefs = documents.filter((d) => d.status === "ready").map((d) => ({ id: d.id, filename: d.filename }));

  return (
    <>
      <PageHeading
        eyebrow="Knowledge vault / Course"
        title={course.title}
        description={course.description || "Add assignments and course notes for this course."}
        actions={<><CourseDialog course={course} small /><DeleteCourse id={course.id} title={course.title} /></>}
      />
      <div className="schedule-layout">
        <AssignmentsPanel courseId={course.id} assignments={assignments} timezone={profile.timezone} now={now} checklists={checklists} briefs={briefs} />
        <DocumentsPanel courseId={course.id} documents={documents} />
      </div>
      <EvidenceSearch courseId={course.id} enabled={documents.some((d) => d.status === "ready")} />
    </>
  );
}
