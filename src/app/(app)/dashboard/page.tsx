import { TrackerGlance } from "@/components/features/insights/recovery-tracker";
import { getTracker } from "@/lib/db/tracker";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Check, Clock3, Leaf, Play, RefreshCcw, Sparkles, Target } from "lucide-react";
import PhotoHero from "@/components/nature/photo-hero";
import ListenButton from "@/components/ui/listen-button";
import { ButtonLink } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listAgentRuns } from "@/lib/db/agent-runs";
import { getPracticeEvidence } from "@/lib/quiz/service";
import { getOverview } from "@/lib/db/overview";
import { getProfile } from "@/lib/db/profiles";
import { getActivePlan } from "@/lib/db/tasks";
import { missedBlocks } from "@/lib/planner/progress";
import { computePlan } from "@/lib/planner/service";
import { renderTime } from "@/lib/server/clock";
import { formatDateTime, formatMinutes } from "@/lib/time";

export const metadata: Metadata = { title: "Mission control" };

export default async function DashboardPage() {
  const { supabase, user } = await requirePageUser("/dashboard");
  const now = await renderTime();
  // The glance only uses per-assignment states, which don't depend on the time zone.
  const [overview, profile, plan, active, runs, practice, tracker] = await Promise.all([
    getOverview(supabase),
    getProfile(supabase, user.id),
    computePlan(supabase, user.id, { now }),
    getActivePlan(supabase),
    listAgentRuns(supabase, 1),
    getPracticeEvidence(supabase, now),
    getTracker(supabase, "UTC", now),
  ]);
  const tz = profile.timezone;
  const firstName = (profile.displayName ?? "").split(" ")[0] || "there";
  const balanced = plan.scenarios.find((s) => s.key === "balanced")!;
  const hasWork = balanced.requiredMinutes > 0;
  const weekly = profile.weeklyMinutes.reduce((sum, m) => sum + m, 0);
  const weekAhead = overview.assignments.filter((a) => a.status !== "completed" && Date.parse(a.dueAt) >= now && Date.parse(a.dueAt) <= now + 7 * 86400_000);
  const dayKey = (iso: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const tasks = (active?.tasks ?? []).filter((t) => t.status !== "cancelled");
  const todays = tasks.filter((t) => dayKey(t.startsAt) === dayKey(now));
  const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const lastRun = runs.at(-1);
  const behind = hasWork && !balanced.feasible;
  const mastery = practice.progress.length ? Math.round(practice.progress.reduce((s, p) => s + p.latest, 0) / practice.progress.length) : null;
  const dueRevision = practice.revision.filter((r) => r.due).length;
  const missed = missedBlocks(tasks, now);
  const missedMinutes = missed.reduce((sum, t) => sum + t.durationMinutes, 0);

  const briefing = !overview.courses.length
    ? "Start by adding a course with its deadlines. Your briefing builds itself from your real work."
    : hasWork
      ? `${weekAhead.length} deadline${weekAhead.length === 1 ? "" : "s"} in the next 7 days · ${formatMinutes(balanced.requiredMinutes)} of recommended work · ${formatMinutes(balanced.availableBeforeDeadlineMinutes)} of study time before ${formatDateTime(balanced.lastDeadline, tz, { hour: undefined, minute: undefined })}.`
      : "No upcoming deadlines. A good moment for a knowledge check or a focus session.";
  const status = !hasWork
    ? "Every step forward counts"
    : balanced.feasible
      ? `Your balanced plan fits, with ${formatMinutes(Math.max(0, balanced.availableBeforeDeadlineMinutes - balanced.requiredMinutes))} to spare`
      : `About ${formatMinutes(balanced.shortfallMinutes)} short: compare routes`;

  return (
    <>
      <PhotoHero labelledBy="dash-heading" label="Your recovery briefing">
        <div className="eyebrow">Weekly recovery briefing</div>
        <h1 id="dash-heading">{behind ? `Back on track, ${firstName}` : `Good to see you, ${firstName}`}</h1>
        <p>{briefing}</p>
        <div className="nf-hero-actions">
          <ButtonLink href="/assistant?rescue=1" variant="primary"><BookOpen className="ic" aria-hidden="true" /> Missed class rescue</ButtonLink>
          <ButtonLink href={hasWork ? "/recovery" : "/courses"}><Target className="ic" aria-hidden="true" /> {hasWork ? "Plan recovery" : "Add a course"}</ButtonLink>
          <ButtonLink href="/focus"><Play className="ic" aria-hidden="true" /> Focus sprint</ButtonLink>
        </div>
        <div className="nf-hero-foot">
          <p className="nf-hero-status"><Leaf className="ic" aria-hidden="true" /> {status}</p>
          <ListenButton
            label="Listen to my briefing"
            text={`${behind ? "Back on track" : "Good to see you"}, ${firstName}. ${briefing} ${status}. ${todays.length ? `Today: ${todays.map((t) => `${timeFmt.format(new Date(t.startsAt))}, ${t.title}`).join("; ")}.` : "Nothing is scheduled for today."}`}
          />
        </div>
      </PhotoHero>

      {missed.length ? (
        <section className="card nf-replan" aria-labelledby="replan-head">
          <span className="nf-replan-icon" aria-hidden="true"><RefreshCcw className="ic" /></span>
          <div>
            <h2 id="replan-head">You missed {missed.length} study block{missed.length === 1 ? "" : "s"} · {formatMinutes(missedMinutes)}</h2>
            <p>That&apos;s okay. Replanning starts from now, keeps what you completed, and reschedules the rest. Nothing changes until you approve.</p>
          </div>
          <ButtonLink href="/recovery?replan=1" variant="primary">Replan from now <ArrowRight className="ic" aria-hidden="true" /></ButtonLink>
        </section>
      ) : null}

      <ul className="nf-stats" aria-label="This week at a glance">
        <Stat label="Capacity" value={formatMinutes(weekly)} caption="Study time this week" icon={<Clock3 className="ic" />} />
        <Stat label="Deadlines" value={String(weekAhead.length)} caption={weekAhead.length === 1 ? "Assignment due" : "Assignments due"} icon={<CalendarDays className="ic" />} />
        <Stat label="Fits now" value={hasWork ? `${balanced.coveragePercent}%` : "—"} caption={hasWork ? "Current balanced route" : "No work to plan yet"} icon={<Target className="ic" />} />
        <Stat
          label="Mastery"
          value={mastery === null ? "—" : `${mastery}%`}
          caption={mastery === null ? "Take a knowledge check" : dueRevision ? `${dueRevision} concept${dueRevision === 1 ? "" : "s"} due for revision` : "Latest practice scores"}
          icon={<Leaf className="ic" />}
        />
      </ul>

      <TrackerGlance rows={tracker.rows} />

      <div className="nf-panels">
        <section className="card nf-panel" aria-labelledby="routes-head">
          <h2 id="routes-head">Recovery routes</h2>
          {hasWork ? (
            <ul className="nf-list" aria-label="Recovery routes">
              {plan.scenarios.map((s) => (
                <li key={s.key}>
                  <Link href="/recovery" className="nf-row">
                    <span className={`nf-dot ${s.feasible ? "ok" : "short"}`} aria-hidden="true">{s.feasible ? <Check className="ic" /> : "!"}</span>
                    <strong>{s.title}</strong>
                    <span className={`nf-status ${s.feasible ? "ok" : "short"}`}>{s.feasible ? "Fits" : `Short ${formatMinutes(s.shortfallMinutes)}`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="nf-empty">Routes appear once you have upcoming assignments.</p>
          )}
        </section>

        <section className="card nf-panel" aria-labelledby="trail-head">
          <h2 id="trail-head">Today on the trail</h2>
          {todays.length ? (
            <ul className="nf-list" aria-label="Today's study blocks">
              {todays.slice(0, 4).map((t) => {
                const doneBlock = t.status === "completed";
                const next = !doneBlock && Date.parse(t.endsAt) > now;
                return (
                  <li key={t.id}>
                    <Link href="/planner" className="nf-row nf-trail">
                      <time dateTime={t.startsAt}>{timeFmt.format(new Date(t.startsAt))}</time>
                      <span className="nf-trail-body">
                        <strong>{t.title}</strong>
                        <span>{formatMinutes(t.durationMinutes)} · {doneBlock ? "Completed" : next ? "Next session" : "Missed"}</span>
                      </span>
                      {doneBlock ? <span className="nf-dot ok" aria-hidden="true"><Check className="ic" /></span> : <ArrowRight className="ic nf-go" aria-hidden="true" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="nf-empty">{active ? "Nothing scheduled today. Enjoy the breathing room." : "Approve a recovery route to see today's blocks."}</p>
          )}
        </section>

        <section className="card nf-panel" aria-labelledby="copilot-head">
          <h2 id="copilot-head">Copilot activity</h2>
          <div className="nf-activity">
            <span className="nf-activity-icon" aria-hidden="true"><Sparkles className="ic" /></span>
            {lastRun ? (
              <span>
                <strong>{lastRun.events.length} tool{lastRun.events.length === 1 ? "" : "s"} ran</strong>
                <span>{lastRun.proposal?.status === "pending" ? "1 draft waiting for approval" : lastRun.proposal ? `Draft ${lastRun.proposal.status}` : `Run ${lastRun.status}`}</span>
              </span>
            ) : (
              <span><strong>No runs yet</strong><span>Every tool the copilot runs is logged here.</span></span>
            )}
          </div>
          <Link className="nf-row nf-link" href={lastRun?.proposal?.status === "pending" ? `/recovery?proposal=${lastRun.proposal.id}` : "/assistant"}>
            <span>{lastRun?.proposal?.status === "pending" ? "Review the suggested plan" : "Ask the copilot"}</span>
            <ArrowRight className="ic nf-go" aria-hidden="true" />
          </Link>
        </section>
      </div>

      <p className="nf-footnote"><Leaf className="ic" aria-hidden="true" /> Learning grows through small, steady steps.</p>
    </>
  );
}

function Stat({ label, value, caption, icon }: { label: string; value: string; caption: string; icon: React.ReactNode }) {
  return (
    <li className="card nf-stat">
      <span className="nf-stat-label">{label}</span>
      <span className="nf-stat-icon" aria-hidden="true">{icon}</span>
      <strong>{value}</strong>
      <span className="nf-stat-caption">{caption}</span>
    </li>
  );
}
