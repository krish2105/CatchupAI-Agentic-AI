import type { Metadata } from "next";
import { ArrowRight, CalendarClock, Clock3, Layers, Orbit, Target } from "lucide-react";
import OrbPanel from "@/components/three/orb-panel";
import { ButtonLink, Chip, EmptyCard, ProgressArc, StatCard } from "@/components/ui/primitives";
import Link from "next/link";

export const metadata: Metadata = { title: "Mission control" };

export default function DashboardPage() {
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
          <OrbPanel graph={{ nodes: [] }} />
        </div>
      </section>

      <div className="stat-row">
        <StatCard label="Study capacity" value={null} caption="Set your weekly availability" icon={Clock3} />
        <StatCard label="Coming up" value={null} caption="Assignments due in 14 days" icon={CalendarClock} />
        <StatCard label="Recovery outlook" value={null} caption="Share of work that fits" icon={Target} />
        <StatCard label="Learning worlds" value={null} caption="Courses in your orbit" icon={Layers} />
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
        <EmptyCard icon={Layers} title="No courses yet" action={<ButtonLink href="/courses" variant="primary" small>Create a course</ButtonLink>}>
          Each course becomes a world in your learning universe, with its documents and assignments orbiting around it.
        </EmptyCard>
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
