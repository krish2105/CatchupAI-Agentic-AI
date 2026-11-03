import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import PlannerView from "@/components/features/planner/planner-view";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, EmptyCard, Notice } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/db/courses";
import { getProfile } from "@/lib/db/profiles";
import { getActivePlan } from "@/lib/db/tasks";
import { TZDate } from "@date-fns/tz";
import { listAssignments } from "@/lib/db/assignments";
import { renderTime } from "@/lib/server/clock";

export const metadata: Metadata = { title: "Study schedule" };

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ approved?: string; week?: string }> }) {
  const { supabase, user } = await requirePageUser("/planner");
  const [plan, profile, courses, params, now, assignments] = await Promise.all([getActivePlan(supabase), getProfile(supabase, user.id), listCourses(supabase), searchParams, renderTime(), listAssignments(supabase)]);
  const weekOffset = Math.max(-52, Math.min(52, Number.parseInt(params.week ?? "0", 10) || 0));
  const today = new TZDate(now, profile.timezone);
  const monday = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7, 0, 0, 0, profile.timezone);
  const weekEnd = monday.getTime() + 7 * 86400_000;
  const deadlines = assignments
    .filter((a) => a.status !== "completed" && Date.parse(a.dueAt) >= monday.getTime() && Date.parse(a.dueAt) < weekEnd)
    .map((a) => ({ id: a.id, title: a.title, dueAt: a.dueAt }));
  return (
    <>
      <PageHeading
        eyebrow="Your time / your terms"
        title="A calmer"
        accent="kind of calendar."
        accentColor="aqua"
        description="Approved recovery tasks become your study schedule, shown in your own time zone. Tick blocks off as you complete them."
        actions={<ButtonLink href="/recovery" variant="primary" small>Compare plans</ButtonLink>}
      />
      {params.approved && plan ? <div style={{ marginBottom: 16 }}><Notice tone="info" title="Plan approved and saved.">Your schedule below is stored in your account.</Notice></div> : null}
      {plan ? (
        <PlannerView plan={plan} timezone={profile.timezone} courseNames={Object.fromEntries(courses.map((c) => [c.id, c.title]))} now={now} weekStart={new Date(monday.getTime()).toISOString()} weekOffset={weekOffset} deadlines={deadlines} />
      ) : (
        <EmptyCard icon={CalendarDays} title="No approved plan yet" action={<ButtonLink href="/recovery" small>Open the recovery lab</ButtonLink>}>
          Review and approve a recovery route in the lab to populate your schedule. Rejected proposals never create tasks.
        </EmptyCard>
      )}
    </>
  );
}
