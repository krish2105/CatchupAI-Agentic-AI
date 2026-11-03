import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import PlannerView from "@/components/features/planner/planner-view";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, EmptyCard, Notice } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/db/courses";
import { getProfile } from "@/lib/db/profiles";
import { getActivePlan } from "@/lib/db/tasks";
import { renderTime } from "@/lib/server/clock";

export const metadata: Metadata = { title: "Study schedule" };

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ approved?: string }> }) {
  const { supabase, user } = await requirePageUser("/planner");
  const [plan, profile, courses, params, now] = await Promise.all([getActivePlan(supabase), getProfile(supabase, user.id), listCourses(supabase), searchParams, renderTime()]);
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
        <PlannerView plan={plan} timezone={profile.timezone} courseNames={Object.fromEntries(courses.map((c) => [c.id, c.title]))} now={now} />
      ) : (
        <EmptyCard icon={CalendarDays} title="No approved plan yet" action={<ButtonLink href="/recovery" small>Open the recovery lab</ButtonLink>}>
          Review and approve a recovery route in the lab to populate your schedule. Rejected proposals never create tasks.
        </EmptyCard>
      )}
    </>
  );
}
