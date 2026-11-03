import type { Metadata } from "next";
import Landscape from "@/components/nature/landscape";
import FocusTimer from "@/components/features/focus/focus-timer";
import PageHeading from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listFocusSessions } from "@/lib/db/focus";
import { getProfile } from "@/lib/db/profiles";
import { getActivePlan } from "@/lib/db/tasks";
import { renderTime } from "@/lib/server/clock";
import { formatMinutes } from "@/lib/time";

export const metadata: Metadata = { title: "Focus sanctuary" };

export default async function FocusPage() {
  const { supabase, user } = await requirePageUser("/focus");
  const now = await renderTime();
  const [profile, active, sessions] = await Promise.all([getProfile(supabase, user.id), getActivePlan(supabase), listFocusSessions(supabase, new Date(now - 7 * 86400_000).toISOString())]);
  const tz = profile.timezone;
  const day = (iso: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit" });
  const blocks = (active?.tasks ?? [])
    .filter((t) => t.status === "todo" && Date.parse(t.endsAt) > now - 12 * 3600_000)
    .slice(0, 12)
    .map((t) => ({ id: t.id, title: t.title, durationMinutes: t.durationMinutes, startsAtLabel: timeFmt.format(new Date(t.startsAt)) }));
  const today = sessions.filter((s) => day(s.startedAt) === day(now));
  const weekMinutes = sessions.reduce((s, x) => s + x.focusedMinutes, 0);

  return (
    <>
      <PageHeading
        eyebrow="Quiet time, real progress"
        title="Your focus"
        accent="sanctuary."
        accentColor="aqua"
        description="Pick a study block, start the timer and step away from everything else. Each session is saved to your history and can complete the block it belongs to."
      />
      <section className="focus-stage" aria-label="Focus timer">
        <Landscape />
        <FocusTimer blocks={blocks} />
      </section>
      <div className="stat-row">
        <StatCard label="Today" value={today.length ? formatMinutes(today.reduce((s, x) => s + x.focusedMinutes, 0)) : null} caption={`${today.length} session${today.length === 1 ? "" : "s"} saved`} />
        <StatCard label="Last 7 days" value={weekMinutes ? formatMinutes(weekMinutes) : null} caption="Self-tracked focus time" />
        <StatCard label="Completed sessions" value={sessions.length ? String(sessions.filter((s) => s.completed).length) : null} caption="Ran the full planned length" />
        <StatCard label="Open blocks" value={String(blocks.length)} caption={active ? "From your approved plan" : "No approved plan"} />
      </div>
    </>
  );
}
