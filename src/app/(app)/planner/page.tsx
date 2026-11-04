import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import CalendarCard from "@/components/features/planner/calendar-card";
import MonthCalendar from "@/components/features/planner/month-calendar";
import PlannerView from "@/components/features/planner/planner-view";
import TrustDrawer from "@/components/features/recovery/trust-drawer";
import Thumbs from "@/components/ui/thumbs";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, EmptyCard, Notice } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/db/courses";
import { getProfile } from "@/lib/db/profiles";
import { getActivePlan, getPendingDraft } from "@/lib/db/tasks";
import { TZDate } from "@date-fns/tz";
import { listAssignments } from "@/lib/db/assignments";
import { listFocusSessions } from "@/lib/db/focus";
import { getPracticeEvidence } from "@/lib/quiz/service";
import { renderTime } from "@/lib/server/clock";

export const metadata: Metadata = { title: "Study schedule" };

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ approved?: string; week?: string; view?: string }> }) {
  const { supabase, user } = await requirePageUser("/planner");
  const now = await renderTime();
  const [plan, profile, courses, params, assignments, feed, focus, practice, draft] = await Promise.all([
    getActivePlan(supabase), getProfile(supabase, user.id), listCourses(supabase), searchParams, listAssignments(supabase), supabase.from("calendar_feeds").select("created_at").maybeSingle(),
    listFocusSessions(supabase, new Date(now - 180 * 86400_000).toISOString()), getPracticeEvidence(supabase, now), getPendingDraft(supabase, now),
  ]);
  const initialView = params.view === "month" || params.view === "list" ? params.view : "week";
  const month = {
    deadlines: assignments.map((a) => ({ id: a.id, title: a.title, courseId: a.courseId, dueAt: a.dueAt, required: a.required, status: a.status })),
    focus: focus.map((f) => ({ startedAt: f.startedAt, focusedMinutes: f.focusedMinutes })),
    revision: practice.revision.map((r) => ({ dueAt: r.dueAt })),
    drafts: draft?.blocks ?? [],
    draftHref: draft ? `/recovery?proposal=${draft.proposalId}` : undefined,
  };
  const courseNames = Object.fromEntries(courses.map((c) => [c.id, c.title]));
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
        title="A calmer kind of calendar."
        description="Approved recovery tasks become your study schedule, shown in your own time zone. Tick blocks off as you complete them."
        actions={<>{plan ? <TrustDrawer proposalId={plan.proposalId} label="Why this plan?" /> : null}<ButtonLink href="/recovery" variant="primary" small>Compare plans</ButtonLink></>}
      />
      {params.approved && plan ? <div style={{ marginBottom: 16 }}><Notice tone="info" title="Plan approved and saved.">Your schedule below is stored in your account.</Notice></div> : null}
      {plan ? <CalendarCard hasFeed={Boolean(feed.data)} feedCreatedAt={feed.data?.created_at ?? null} /> : null}
      {plan ? <div className="thumbs-row"><Thumbs kind="plan" refId={plan.id} question="Is this plan working for you?" /></div> : null}
      {plan ? (
        <PlannerView plan={plan} timezone={profile.timezone} courseNames={courseNames} now={now} weekStart={new Date(monday.getTime()).toISOString()} weekOffset={weekOffset} deadlines={deadlines} initialView={initialView} month={month} />
      ) : (
        <>
          <EmptyCard icon={CalendarDays} title="No approved plan yet" action={<ButtonLink href="/recovery" small>Open the recovery lab</ButtonLink>}>
            Review and approve a recovery route in the lab to populate your schedule. Rejected proposals never create tasks.
          </EmptyCard>
          {/* Deadlines, focus time and revision still show on the calendar before any plan exists. */}
          {assignments.length || month.drafts.length ? <div className="section-space"><MonthCalendar timezone={profile.timezone} now={now} tasks={[]} deadlines={month.deadlines} focus={month.focus} revision={month.revision} drafts={month.drafts} draftHref={month.draftHref} courseNames={courseNames} /></div> : null}
        </>
      )}
    </>
  );
}
