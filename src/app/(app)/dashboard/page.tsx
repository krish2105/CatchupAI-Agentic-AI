import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, CalendarClock, CheckCircle2, Circle, Clock3, FlaskConical, Layers, LifeBuoy, Target } from "lucide-react";
import Landscape from "@/components/nature/landscape";
import { ButtonLink, Chip, EmptyCard, ProgressArc, StatCard } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listAgentRuns } from "@/lib/db/agent-runs";
import { getOverview } from "@/lib/db/overview";
import { getProfile } from "@/lib/db/profiles";
import { getActivePlan } from "@/lib/db/tasks";
import { computePlan } from "@/lib/planner/service";
import { renderTime } from "@/lib/server/clock";
import { formatDateTime, formatMinutes } from "@/lib/time";

export const metadata: Metadata = { title: "Mission control" };

const COURSE_COLORS = ["var(--aqua)", "var(--violet)", "var(--coral)", "var(--accent)"];

export default async function DashboardPage() {
  const { supabase, user } = await requirePageUser("/dashboard");
  const now = await renderTime();
  const [overview, profile, plan, active, runs] = await Promise.all([
    getOverview(supabase),
    getProfile(supabase, user.id),
    computePlan(supabase, user.id, { now }),
    getActivePlan(supabase),
    listAgentRuns(supabase, 1),
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
  const nextBlock = tasks.find((t) => t.status === "todo" && Date.parse(t.endsAt) > now);
  const done = tasks.filter((t) => t.status === "completed").length;
  const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const lastRun = runs.at(-1);
  const dateLabel = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(now));

  const briefing = !overview.courses.length
    ? "Start by adding a course with its deadlines. Your briefing builds itself from your real work."
    : hasWork
      ? `${weekAhead.length} deadline${weekAhead.length === 1 ? "" : "s"} in the next 7 days · ${formatMinutes(balanced.requiredMinutes)} of recommended work · ${formatMinutes(balanced.availableBeforeDeadlineMinutes)} of study time before ${formatDateTime(balanced.lastDeadline, tz, { hour: undefined, minute: undefined })}.`
      : "No upcoming deadlines. A good moment for a knowledge check or a focus session.";

  const nextAction = nextBlock
    ? { label: `Next: ${nextBlock.title}`, detail: `${formatDateTime(nextBlock.startsAt, tz)} · ${formatMinutes(nextBlock.durationMinutes)}`, href: "/planner" }
    : hasWork
      ? { label: balanced.feasible ? "Approve a recovery route" : "Your week is over capacity", detail: balanced.feasible ? "The balanced route fits your time." : `Short by ${formatMinutes(balanced.shortfallMinutes)}. Compare routes.`, href: "/recovery" }
      : { label: "Add your course work", detail: "Courses, deadlines and notes power every recommendation.", href: "/courses" };

  return (
    <>
      <section className="hero" aria-labelledby="dash-heading">
        <Landscape />
        <div className="hero-copy">
          <div className="eyebrow">Weekly recovery briefing · {dateLabel}</div>
          <h1 id="dash-heading">
            {hasWork && !balanced.feasible ? "Let's get you" : "Make a little"} <em>{hasWork && !balanced.feasible ? `back on track, ${firstName}.` : "room for progress."}</em>
          </h1>
          <p>{briefing}</p>
          <div className="hero-ctas">
            <ButtonLink href="/assistant?rescue=1" variant="primary"><LifeBuoy className="ic" aria-hidden="true" /> Missed class rescue</ButtonLink>
            <ButtonLink href="/recovery" variant="ghost"><FlaskConical className="ic" aria-hidden="true" /> Plan recovery</ButtonLink>
          </div>
        </div>
        <div className="hero-visual" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "28px" }}>
          <div className="glass" style={{ padding: 20, width: "min(100%, 320px)", display: "grid", gap: 12 }} aria-label="Your recovery plan">
            <div className="split-head" style={{ marginBottom: 0 }}>
              <span className="label">Your recovery plan</span>
              {active ? <Chip tone="good">Active</Chip> : <Chip>Not approved</Chip>}
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <ProgressArc percent={active ? (tasks.length ? Math.round((done / tasks.length) * 100) : 0) : hasWork ? balanced.coveragePercent : null} caption={active ? "Blocks done" : "Fits now"} />
            </div>
            <Link href={nextAction.href} className="focus-item" style={{ borderBottom: 0, padding: 0, textDecoration: "none" }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ overflowWrap: "anywhere" }}>{nextAction.label}</strong>
                <p>{nextAction.detail}</p>
              </div>
              <span><ArrowRight className="ic" aria-hidden="true" /></span>
            </Link>
          </div>
        </div>
      </section>

      <div className="stat-row">
        <StatCard label="Study capacity" value={formatMinutes(weekly)} caption="Per week, from your settings" icon={Clock3} />
        <StatCard label="Coming up" value={String(overview.upcomingCount).padStart(2, "0")} caption="Assignments due in 14 days" icon={CalendarClock} />
        <StatCard label="Recovery outlook" value={hasWork ? `${balanced.coveragePercent}%` : null} caption={hasWork ? "Of the balanced route fits" : "No upcoming work"} icon={Target} />
        <StatCard label="Learning worlds" value={String(overview.courses.length).padStart(2, "0")} caption="Courses in your universe" icon={Layers} />
      </div>

      <div className="three-column">
        <div className="card card-inner">
          <div className="split-head"><h3>Recovery routes</h3><Link className="text-link" href="/recovery">Compare <ArrowRight className="ic" aria-hidden="true" /></Link></div>
          {hasWork ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Recovery routes">
              {plan.scenarios.map((s) => (
                <li key={s.key} className="task-item">
                  <span>{s.title}</span>
                  {s.feasible ? <Chip tone="good">Fits</Chip> : <Chip tone="warn">Short {formatMinutes(s.shortfallMinutes)}</Chip>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>Routes appear once you have upcoming assignments.</p>
          )}
        </div>
        <div className="card card-inner">
          <div className="split-head"><h3>Today on the trail</h3><Chip>{todays.length} block{todays.length === 1 ? "" : "s"}</Chip></div>
          {todays.length ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Today's study blocks">
              {todays.slice(0, 4).map((t) => (
                <li key={t.id} className="task-item">
                  <span style={{ minWidth: 0 }}>
                    {t.status === "completed" ? <CheckCircle2 className="ic" aria-hidden="true" style={{ color: "var(--good)" }} /> : <Circle className="ic" aria-hidden="true" />}
                    <span style={{ overflowWrap: "anywhere", textDecoration: t.status === "completed" ? "line-through" : undefined }}>{timeFmt.format(new Date(t.startsAt))} · {t.title}</span>
                  </span>
                  <b>{t.durationMinutes}m</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>{active ? "Nothing scheduled today. Enjoy the breathing room." : "Approve a recovery route to see today's blocks."}</p>
          )}
          {active ? <Link className="text-link" href="/planner" style={{ marginTop: 12 }}>Open schedule <ArrowRight className="ic" aria-hidden="true" /></Link> : null}
        </div>
        <div className="card card-inner">
          <div className="split-head"><h3>Copilot activity</h3><Activity className="ic" aria-hidden="true" style={{ color: "var(--aqua)" }} /></div>
          {lastRun ? (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.6, overflowWrap: "anywhere" }}>“{lastRun.request.slice(0, 90)}{lastRun.request.length > 90 ? "…" : ""}”</p>
              <p style={{ fontSize: 12 }}>
                {lastRun.events.length} tool{lastRun.events.length === 1 ? "" : "s"} ran · {lastRun.status}
                {lastRun.proposal ? ` · draft ${lastRun.proposal.status}` : ""}
              </p>
              {lastRun.proposal?.status === "pending" ? <ButtonLink href={`/recovery?proposal=${lastRun.proposal.id}`} small variant="primary">Review draft</ButtonLink> : <ButtonLink href="/assistant" small>Open copilot</ButtonLink>}
            </div>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>No copilot runs yet. Every tool it executes is logged here.</p>
              <ButtonLink href="/assistant" small style={{ marginTop: 10 }}>Ask the copilot</ButtonLink>
            </>
          )}
        </div>
      </div>

      <div className="section-space">
        <div className="split-head">
          <h3 style={{ fontSize: 18 }}>Your learning worlds</h3>
          <Link className="text-link" href="/courses">Open knowledge vault <ArrowRight className="ic" aria-hidden="true" /></Link>
        </div>
        {overview.courses.length === 0 ? (
          <EmptyCard icon={Layers} title="Plant your first course" action={<ButtonLink href="/courses" variant="primary" small>Create a course</ButtonLink>}>
            Each course becomes a world in your learning universe, with its documents and assignments around it.
          </EmptyCard>
        ) : (
          <div className="three-column">
            {overview.graph.nodes.slice(0, 6).map((node, i) => {
              const course = overview.courses.find((c) => c.id === node.id)!;
              return (
                <Link key={node.id} href={node.href} className="card course-card" style={{ textDecoration: "none" }}>
                  <div className="course-art" style={{ color: COURSE_COLORS[i % COURSE_COLORS.length] }}><Layers className="ic" aria-hidden="true" /></div>
                  <div>
                    <h4>{course.title}</h4>
                    <p>{course.assignmentCount} assignment{course.assignmentCount === 1 ? "" : "s"} · {course.documentCount} document{course.documentCount === 1 ? "" : "s"}</p>
                    <div className="microbar" aria-hidden="true"><span style={{ width: `${node.progress ?? 0}%`, background: COURSE_COLORS[i % COURSE_COLORS.length] }} /></div>
                    <div className="course-footer"><span>{node.progress === null ? "No active plan" : `${node.progress}% of plan blocks done`}</span></div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
