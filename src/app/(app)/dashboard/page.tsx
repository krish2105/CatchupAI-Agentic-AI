import type { Metadata } from "next";
import { ArrowRight, CalendarClock, Clock3, Layers, Orbit, Target } from "lucide-react";
import OrbPanel from "@/components/three/orb-panel";
import { ButtonLink, Chip, EmptyCard, ProgressArc, StatCard } from "@/components/ui/primitives";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/session";
import { getOverview } from "@/lib/db/overview";
import { getProfile } from "@/lib/db/profiles";
import { formatMinutes } from "@/lib/time";

export const metadata: Metadata = { title: "Mission control" };

const COURSE_COLORS = ["var(--aqua)", "var(--violet)", "var(--coral)", "var(--accent)"];

export default async function DashboardPage() {
  const { supabase, user } = await requirePageUser("/dashboard");
  const [overview, profile] = await Promise.all([getOverview(supabase), getProfile(supabase, user.id)]);
  const weekly = profile.weeklyMinutes.reduce((sum, m) => sum + m, 0);
  return (
    <>
      <section className="hero" aria-labelledby="dash-heading">
        <div className="hero-copy">
          <div className="eyebrow">01 / Your recovery station</div>
          <h1 id="dash-heading">Make a little <em>room for progress.</em></h1>
          <p>Your courses, deadlines and next best moves, connected. Let your AI copilot turn getting behind into getting back on track.</p>
          <div className="hero-ctas">
            <ButtonLink href="/recovery" variant="primary">Start a recovery <ArrowRight className="ic" aria-hidden="true" /></ButtonLink>
            <ButtonLink href="/universe" variant="ghost">Explore the 3D atlas <Orbit className="ic" aria-hidden="true" /></ButtonLink>
          </div>
        </div>
        <div className="hero-visual">
          <OrbPanel graph={overview.graph} />
        </div>
      </section>

      <div className="stat-row">
        <StatCard label="Study capacity" value={formatMinutes(weekly)} caption="Available per week (your settings)" icon={Clock3} />
        <StatCard label="Coming up" value={String(overview.upcomingCount).padStart(2, "0")} caption="Assignments due in 14 days" icon={CalendarClock} />
        <StatCard label="Recovery outlook" value={null} caption="Compare routes in the lab" icon={Target} />
        <StatCard label="Learning worlds" value={String(overview.courses.length).padStart(2, "0")} caption="Courses in your orbit" icon={Layers} />
      </div>

      <div className="trajectory">
        <div className="trajectory-card">
          <div className="split-head">
            <h3>Your recovery trajectory</h3>
            <Link className="text-link" href="/recovery">Explore strategies <ArrowRight className="ic" aria-hidden="true" /></Link>
          </div>
          <div className="trajectory-layout">
            <div>
              <div className="eyebrow">Feasibility, not guesswork</div>
              <div className="trajectory-title">Nothing to calculate yet.</div>
              <p className="trajectory-sub">Add a course with assignments and set your study availability. CatchUp AI will compare the estimated work with the time you really have.</p>
              <ButtonLink href="/courses" small style={{ marginTop: 17 }}>Add your first course</ButtonLink>
            </div>
            <ProgressArc percent={null} caption="Plan capacity" />
          </div>
        </div>
        <div className="card focus-list">
          <div className="split-head"><h3>Today&apos;s focus</h3><Chip>0 tasks</Chip></div>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>Approved study tasks scheduled for today appear here.</p>
        </div>
      </div>

      <div className="section-space">
        <div className="split-head">
          <h3 style={{ fontSize: 18 }}>Your learning worlds</h3>
          <Link className="text-link" href="/courses">Open knowledge vault <ArrowRight className="ic" aria-hidden="true" /></Link>
        </div>
        {overview.courses.length === 0 ? (
          <EmptyCard icon={Layers} title="No courses yet" action={<ButtonLink href="/courses" variant="primary" small>Create a course</ButtonLink>}>
            Each course becomes a world in your learning universe, with its documents and assignments orbiting around it.
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
                    <div className="course-footer">
                      <span>{node.progress === null ? "No active plan" : `${node.progress}% of plan tasks done`}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="two-column section-space">
        <div className="card card-inner">
          <div className="split-head"><h3>From overwhelmed to organized</h3><Chip tone="good">Approval-gated</Chip></div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
            The recovery engine finds the work that matters, compares achievable options, and prepares the changes. You decide what gets saved.
          </p>
          <div className="gallery-meta">
            <ButtonLink href="/assistant" variant="primary" small>Ask the copilot <ArrowRight className="ic" aria-hidden="true" /></ButtonLink>
            <ButtonLink href="/quizzes" small>Try a knowledge check</ButtonLink>
          </div>
        </div>
        <div className="card card-inner">
          <div className="split-head"><h3>What the AI will do</h3><Chip>Transparent</Chip></div>
          <div className="mini-activity"><div className="activity-dot" /><div><strong>Read your actual course evidence</strong><p>Documents, deadlines and your available time — through logged, permission-checked tools.</p></div></div>
          <div className="mini-activity"><div className="activity-dot" /><div><strong>Compare feasible strategies</strong><p>No impossible timetables disguised as progress.</p></div></div>
          <div className="mini-activity"><div className="activity-dot rose" /><div><strong>Ask before taking an action</strong><p>You approve or reject every proposal.</p></div></div>
        </div>
      </div>
    </>
  );
}
