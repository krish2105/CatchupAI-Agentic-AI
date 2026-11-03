import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AssignmentsPanel from "@/components/features/courses/assignments-panel";
import CourseDialog from "@/components/features/courses/course-dialog";
import DeleteCourse from "@/components/features/courses/delete-course";
import PageHeading from "@/components/ui/page-heading";
import { requirePageUser } from "@/lib/auth/session";
import { listAssignments } from "@/lib/db/assignments";
import { getCourse } from "@/lib/db/courses";
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
  const [assignments, profile] = await Promise.all([listAssignments(supabase, { courseId: id }), getProfile(supabase, user.id)]);
  const now = await renderTime();

  return (
    <>
      <PageHeading
        eyebrow="Knowledge vault / Course"
        title={course.title}
        description={course.description || "Add assignments and course notes for this course."}
        actions={<><CourseDialog course={course} small /><DeleteCourse id={course.id} title={course.title} /></>}
      />
      <div className="schedule-layout">
        <AssignmentsPanel courseId={course.id} assignments={assignments} timezone={profile.timezone} now={now} />
        <div className="card card-inner" id="documents">
          <div className="split-head"><h3>Course documents</h3></div>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>PDF upload and indexing are available once document processing is enabled for this workspace.</p>
        </div>
      </div>
    </>
  );
}
