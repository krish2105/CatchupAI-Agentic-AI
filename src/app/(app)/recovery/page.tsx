import type { Metadata } from "next";
import { FlaskConical, Sparkles } from "lucide-react";
import RecoveryLab from "@/components/features/recovery/recovery-lab";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, EmptyCard } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/db/courses";
import { getProfile } from "@/lib/db/profiles";
import { getActivePlan } from "@/lib/db/tasks";
import { computePlan, getProposal } from "@/lib/planner/service";
import { uuid } from "@/lib/validation/common";
import { renderTime } from "@/lib/server/clock";

export const metadata: Metadata = { title: "Recovery lab" };

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ proposal?: string }> }) {
  const { supabase, user } = await requirePageUser("/recovery");
  const now = await renderTime();
  const [plan, profile, courses, active] = await Promise.all([computePlan(supabase, user.id, { now }), getProfile(supabase, user.id), listCourses(supabase), getActivePlan(supabase)]);
  const todo = (active?.tasks ?? []).filter((t) => t.status === "todo");
  const currentPlan = active ? { todo: todo.length, todoMinutes: todo.reduce((s, t) => s + t.durationMinutes, 0), completed: active.tasks.filter((t) => t.status === "completed").length } : null;
  const hasWork = plan.scenarios[2].requiredMinutes > 0 || plan.overdue.length > 0;
  const requested = (await searchParams).proposal;
  const initialProposal =
    requested && uuid.safeParse(requested).success ? await getProposal(supabase, requested, now).catch(() => null) : null;
  return (
    <>
      <PageHeading
        eyebrow="Realistic study planning"
        title="There is more than one way forward."
        description="Compare the time, trade-offs, and consequences before committing. Routes are calculated from your real deadlines and availability; ones that don't fit can't be approved."
        actions={<ButtonLink href="/assistant" small><Sparkles className="ic" aria-hidden="true" /> Ask copilot</ButtonLink>}
      />
      {hasWork ? (
        <RecoveryLab initialProposal={initialProposal?.status === "pending" ? initialProposal : null} initialPlan={plan} savedWeekly={profile.weeklyMinutes} courseNames={Object.fromEntries(courses.map((c) => [c.id, c.title]))} currentPlan={currentPlan} />
      ) : (
        <EmptyCard icon={FlaskConical} title="Nothing to plan yet" action={<ButtonLink href="/courses" variant="primary" small>Add a course and assignments</ButtonLink>}>
          The lab needs at least one upcoming assignment. Your weekly availability comes from Preferences.
        </EmptyCard>
      )}
    </>
  );
}
