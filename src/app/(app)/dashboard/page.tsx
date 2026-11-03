import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, CalendarClock, CheckCircle2, Circle, Clock3, FileText, FlaskConical, Layers, Leaf, LifeBuoy, Sprout } from "lucide-react";
import Landscape from "@/components/nature/landscape";
import { ButtonLink, Chip, EmptyCard } from "@/components/ui/primitives";
import Sparkline from "@/components/ui/sparkline";
import { requirePageUser } from "@/lib/auth/session";
import { listAgentRuns } from "@/lib/db/agent-runs";
import { getInsights, recentWeakTerms } from "@/lib/db/insights";
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
  const [overview, profile, plan, active, runs, weakTerms] = await Promise.all([
    getOverview(supabase),
    getProfile(supabase, user.id),
    computePlan(supabase, user.id, { now }),
    getActivePlan(supabase),
    listAgentRuns(supabase, 1),
    recentWeakTerms(supabase, new Date(now - 14 * 86400_000).toISOString()),
  ]);
  const insights = await getInsights(supabase, profile.timezone, now);
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

  const weekDeadlines = weekAhead.length;
  const behind = hasWork && !balanced.feasible;
  const outlook = hasWork ? balanced.coveragePercent : null;
  const progressSeries = insights.days.slice(-7).map((d) => d.minutes);
  const progressTotal = progressSeries.reduce((s, m) => s + m, 0);

  return (
    <>
      <section className="hero mc-hero" aria-labelledby="dash-heading">
        <Landscape />
        <div className="hero-copy">
          <div className="eyebrow">Mission control · {dateLabel}</div>
          <h1 id="dash-heading">{behind ? <>Back on track, <em>{firstName}.</em></> : <>Hello, <em>{firstName}.</em></>}</h1>
          <p>{briefing}</p>
        </div>
        <div className="glass mc-briefing" aria-label="Your recovery briefing">
          <span className="label">Your recovery briefing</span>
          <h2>{!overview.courses.length ? "Let's set up your week" : weekDeadlines ? `${weekDeadlines} deadline${weekDeadlines === 1 ? "" : "s"} approaching` : "No deadlines this week"}</h2>
          <p>
            {!hasWork
              ? "Add assignments to see whether your week fits."
              : balanced.feasible
                ? `Your balanced plan fits, with ${formatMinutes(Math.max(0, balanced.availableBeforeDeadlineMinutes - balanced.requiredMinutes))} to spare.`
                : `You're about ${formatMinutes(balanced.shortfallMinutes)} short before your deadlines. Let's build a realistic plan.`}
          </p>
          <ButtonLink href={hasWork ? "/recovery" : "/courses"} variant="primary" small style={{ justifySelf: "start" }}>
            {hasWork ? "Build recovery plan" : "Add a course"} <ArrowRight className="ic" aria-hidden="true" />
          </ButtonLink>
        </div>
        <div className="mc-stats">
          <div className="glass mc-stat">
            <div className="ring" style={{ "--value": outlook ?? 0 } as React.CSSProperties} aria-hidden="true"><Sprout /></div>
            <div><strong>{outlook === null ? "—" : `${outlook}%`}</strong><span>Recovery outlook</span></div>
          </div>
          <div className="glass mc-stat">
            <div className="icon" aria-hidden="true"><CalendarClock className="ic" /></div>
            <div><strong>{weekDeadlines}</strong><span>Deadlines this week</span></div>
          </div>
          <div className="glass mc-stat">
            <div className="icon" aria-hidden="true"><Clock3 className="ic" /></div>
            <div><strong>{formatMinutes(weekly)}</strong><span>Study capacity / week</span></div>
          </div>
          <div className="glass mc-stat">
            <div className="icon" aria-hidden="true"><Layers className="ic" /></div>
            <div><strong>{weakTerms.length ? weakTerms.length : "—"}</strong><span>{weakTerms.length ? "Topics to review" : "No weak topics yet"}</span></div>
          </div>
        </div>
      </section>

      <div className="mc-row">
        <section className="card card-inner" aria-labelledby="next-steps">
          <div className="split-head"><h3 id="next-steps">Suggested next steps</h3><Chip>{nextAction.label}</Chip></div>
          <div className="next-steps">
            <Link className="card next-step" href="/assistant?rescue=1">
              <span className="icon" aria-hidden="true"><LifeBuoy className="ic" /></span>
              <span><strong>Missed class rescue</strong><span>Copilot plans your catch-up</span></span>
              <ArrowRight className="ic go" aria-hidden="true" />
            </Link>
            <Link className="card next-step" href="/focus">
              <span className="icon" aria-hidden="true"><Leaf className="ic" /></span>
              <span><strong>Focus sprint</strong><span>25-minute session</span></span>
              <ArrowRight className="ic go" aria-hidden="true" />
            </Link>
            <Link className="card next-step" href={active ? "/planner" : "/recovery"}>
              <span className="icon" aria-hidden="true"><FlaskConical className="ic" /></span>
              <span><strong>{active ? "Review your plan" : "Review & approve"}</strong><span>{active ? `${done}/${tasks.length} blocks done` : "Compare three routes"}</span></span>
              <ArrowRight className="ic go" aria-hidden="true" />
            </Link>
            <Link className="card next-step" href="/courses?import=syllabus">
              <span className="icon" aria-hidden="true"><FileText className="ic" /></span>
              <span><strong>Import syllabus</strong><span>Extract deadlines, then confirm</span></span>
              <ArrowRight className="ic go" aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section className="card card-inner" aria-labelledby="progress-head">
          <div className="split-head"><h3 id="progress-head">Your progress</h3><Link className="text-link" href="/insights">See insights <ArrowRight className="ic" aria-hidden="true" /></Link></div>
          <strong style={{ fontSize: 26, fontWeight: 800, color: "var(--heading)" }}>{formatMinutes(progressTotal)}</strong>
          <p className="muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>Study blocks completed in the last 7 days</p>
          <Sparkline values={progressSeries} label={`Completed study minutes per day, last 7 days: ${progressSeries.join(", ")}`} />
        </section>
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
