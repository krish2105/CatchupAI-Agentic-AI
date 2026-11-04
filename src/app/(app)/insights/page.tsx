import DaysStudied from "@/components/features/insights/days-studied";
import RecoveryTracker from "@/components/features/insights/recovery-tracker";
import MonthCalendar from "@/components/features/planner/month-calendar";
import { listCourses } from "@/lib/db/courses";
import { listFocusSessions } from "@/lib/db/focus";
import { getActivePlan } from "@/lib/db/tasks";
import { getTracker } from "@/lib/db/tracker";
import { catchupGains } from "@/lib/catchup/gain";
import { getPracticeEvidence } from "@/lib/quiz/service";
import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import ActivityChart from "@/components/features/insights/activity-chart";
import ScoreChart from "@/components/features/insights/score-chart";
import WeekReview from "@/components/features/insights/week-review";
import { getWeekReview } from "@/lib/insights/week";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, Chip, EmptyCard, StatCard } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { getInsights } from "@/lib/db/insights";
import { getProfile } from "@/lib/db/profiles";
import { renderTime } from "@/lib/server/clock";
import { formatMinutes } from "@/lib/time";

export const metadata: Metadata = { title: "Your momentum" };

export default async function InsightsPage() {
  const { supabase, user } = await requirePageUser("/insights");
  const [profile, now] = await Promise.all([getProfile(supabase, user.id), renderTime()]);
  const [data, review, tracker, plan, courses, focus] = await Promise.all([
    getInsights(supabase, profile.timezone, now), getWeekReview(supabase, profile.timezone, now), getTracker(supabase, profile.timezone, now),
    getActivePlan(supabase), listCourses(supabase), listFocusSessions(supabase, new Date(now - 180 * 86400_000).toISOString()),
  ]);
  const gains = catchupGains((await getPracticeEvidence(supabase, now)).progress);
  const courseNames = Object.fromEntries(courses.map((c) => [c.id, c.title]));
  const hasActivity = data.tasksCompleted > 0 || data.quizAttempts > 0 || data.focusSessions14d > 0;
  return (
    <>
      <PageHeading
        eyebrow="The signal behind your progress"
        title="Celebrate the small wins."
        description="Every number here is calculated from your completed study blocks and graded knowledge checks. Nothing is estimated or illustrative."
        actions={<ButtonLink href="/quizzes" small>Take a knowledge check</ButtonLink>}
      />
      <WeekReview review={review} />
      <RecoveryTracker data={tracker} timezone={profile.timezone} extra={<DaysStudied days={data.days} />} />
      {gains.length ? (
        <section className="card card-inner section-space" aria-labelledby="gain-title">
          <div className="split-head"><h2 id="gain-title" className="trace-h2">Before and after catch-up</h2><Chip>From graded checks</Chip></div>
          <p className="muted">First check on a catch-up pack versus the latest, both from the same document. Shown once a pack has both.</p>
          <table className="data-table">
            <caption className="visually-hidden">Catch-up pack scores before and after</caption>
            <thead><tr><th scope="col">Pack</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th></tr></thead>
            <tbody>
              {gains.map((g) => (
                <tr key={`${g.courseId}-${g.document}`}>
                  <td>{g.document}<span className="muted"> · {courseNames[g.courseId] ?? "Course"}</span></td>
                  <td>{Math.round(g.before)}%</td>
                  <td>{Math.round(g.after!)}%</td>
                  <td>{g.gain! >= 0 ? "+" : ""}{Math.round(g.gain!)} points</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {plan?.tasks.some((t) => t.status === "completed") ? (
        <div className="section-space" id="done-calendar">
          <MonthCalendar mode="done" timezone={profile.timezone} now={now} tasks={plan.tasks} deadlines={[]} focus={focus.map((f) => ({ startedAt: f.startedAt, focusedMinutes: f.focusedMinutes }))} revision={[]} courseNames={courseNames} />
        </div>
      ) : null}
      <div className="stat-row">
        <StatCard label="Latest quiz" value={data.latestQuiz ? `${Math.round(data.latestQuiz.score)}%` : null} caption={data.latestQuiz ? data.latestQuiz.topic : "No graded attempts yet"} />
        <StatCard label="Blocks finished" value={data.tasksCompleted ? String(data.tasksCompleted) : null} caption="Across all approved plans" />
        <StatCard label="Focus time" value={data.focusMinutes14d ? formatMinutes(data.focusMinutes14d) : null} caption={`${data.focusSessions14d} session${data.focusSessions14d === 1 ? "" : "s"} · last 14 days`} />
        <StatCard label="Active plan" value={data.activePlan ? `${data.activePlan.done}/${data.activePlan.total}` : null} caption={data.activePlan ? "Blocks done" : "No approved plan"} />
      </div>
      {data.recoveryScore.some((p) => p.score !== null) ? (
        <div className="card chart-card section-space">
          <div className="split-head"><h3>Recovery score</h3><Chip>{`${[...data.recoveryScore].reverse().find((p) => p.score !== null)!.score}% today`}</Chip></div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Share of your current plan&apos;s blocks that were done by the end of each day they were due. It shows keeping up with your own plan, not a grade.</p>
          <ScoreChart points={data.recoveryScore} />
        </div>
      ) : null}
      {hasActivity ? (
        <div className="insight-grid">
          <div className="card chart-card">
            <div className="split-head"><h3>Study minutes, last 14 days</h3><Chip>{formatMinutes(data.minutesCompleted)} total</Chip></div>
            <ActivityChart days={data.days} />
          </div>
          <div className="card card-inner">
            <div className="split-head"><h3>Topic results</h3><Chip>Latest attempt</Chip></div>
            {data.topicScores.length ? (
              <div className="topic-bars">
                {data.topicScores.map((t) => (
                  <div key={t.topic}>
                    <div className="topic-bar-top"><span>{t.topic}</span><span>{Math.round(t.latest)}% · {t.attempts} attempt{t.attempts === 1 ? "" : "s"}</span></div>
                    <div className="topic-track" aria-hidden="true"><span style={{ width: `${t.latest}%`, background: "var(--chart-1)" }} /></div>
                  </div>
                ))}
              </div>
            ) : <p className="muted" style={{ fontSize: 12 }}>No graded knowledge checks yet.</p>}
            <div className="line" style={{ margin: "22px 0 16px" }} />
            <div className="split-head" style={{ marginBottom: 12 }}><h3>Plan progress by course</h3></div>
            {data.courseProgress.length ? (
              <div className="topic-bars">
                {data.courseProgress.map((c) => (
                  <div key={c.courseId}>
                    <div className="topic-bar-top"><span>{c.title}</span><span>{c.done}/{c.total} blocks</span></div>
                    <div className="topic-track" aria-hidden="true"><span style={{ width: `${(c.done / c.total) * 100}%`, background: "var(--chart-1)" }} /></div>
                  </div>
                ))}
              </div>
            ) : <p className="muted" style={{ fontSize: 12 }}>No active plan.</p>}
          </div>
        </div>
      ) : (
        <EmptyCard icon={TrendingUp} title="Not enough evidence yet">
          Complete blocks from an approved plan or finish a knowledge check to see real trends and topic results.
        </EmptyCard>
      )}
    </>
  );
}
