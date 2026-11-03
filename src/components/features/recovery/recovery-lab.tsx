"use client";

import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, CircleDashed, CircleSlash, Leaf, Save, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { ScenarioKey } from "@/lib/planner/engine";
import type { ComputedPlan, ProposalDto } from "@/lib/planner/service";
import { formatDateTime, formatMinutes } from "@/lib/time";
import ApprovalDialog from "./approval-dialog";
import RouteTimeline from "./route-timeline";

const ICON = { essential: Leaf, balanced: CalendarDays, full: Target } as const;

export default function RecoveryLab({
  initialProposal = null,
  initialPlan,
  savedWeekly,
  courseNames,
  currentPlan = null,
}: {
  initialProposal?: ProposalDto | null;
  initialPlan: ComputedPlan;
  savedWeekly: number[];
  courseNames: Record<string, string>;
  /** Unfinished/completed blocks of the plan an approval would replace. */
  currentPlan?: { todo: number; todoMinutes: number; completed: number } | null;
}) {
  const router = useRouter();
  const savedTotal = savedWeekly.reduce((s, m) => s + m, 0);
  const [plan, setPlan] = useState(initialPlan);
  const [weekly, setWeekly] = useState(savedTotal);
  const [selected, setSelected] = useState<ScenarioKey>(() => (["balanced", "essential", "full"] as const).find((k) => initialPlan.scenarios.find((s) => s.key === k)?.feasible) ?? "essential");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalDto | null>(initialProposal);
  const [drafting, setDrafting] = useState(false);
  const request = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    // The server already computed the initial plan; only refetch after the slider or saved settings change.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const id = ++request.current;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api<{ plan: ComputedPlan }>(`/api/recovery${weekly !== savedTotal ? `?weeklyMinutes=${weekly}` : ""}`);
        if (id === request.current) setPlan(res.plan);
      } catch (e) {
        if (id === request.current) setError(e instanceof ClientApiError ? e.message : "Couldn't recompute the routes.");
      } finally {
        if (id === request.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [weekly, savedTotal]);

  const scenario = plan.scenarios.find((s) => s.key === selected)!;
  // Recommendation rule (explainable): the most complete route that still fits; balanced beats full on ties.
  const recommended = (["balanced", "essential", "full"] as const).find((k) => plan.scenarios.find((s) => s.key === k)?.feasible) ?? null;
  const perStudyDay = (tasks: { startsAt: string; minutes: number }[]) => {
    const days = new Set(tasks.map((t) => new Intl.DateTimeFormat("en-CA", { timeZone: plan.timezone }).format(new Date(t.startsAt)))).size;
    return days ? Math.round(tasks.reduce((s, t) => s + t.minutes, 0) / days) : 0;
  };
  const whatIf = weekly !== savedTotal;

  async function saveAvailability() {
    setError(null);
    try {
      await api("/api/profile", { method: "PATCH", body: { weeklyMinutes: plan.weeklyMinutes } });
      // Per-day rounding can change the total slightly; align the slider with what was actually saved.
      setWeekly(plan.weeklyMinutes.reduce((s, m) => s + m, 0));
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't save your availability.");
    }
  }

  async function review() {
    setDrafting(true);
    setError(null);
    try {
      const res = await api<{ proposal: ProposalDto }>("/api/proposals", { method: "POST", body: { scenario: selected } });
      setProposal(res.proposal);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't draft the proposal.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <>
      {plan.overdue.length ? (
        <div style={{ marginBottom: 16 }}>
          <Notice title={`${plan.overdue.length} required item${plan.overdue.length === 1 ? " is" : "s are"} already past due`}>
            {plan.overdue.map((o) => o.title).join(", ")} — not scheduled. Update the due date if you have an extension, or mark it completed.
          </Notice>
        </div>
      ) : null}
      <div className="lab-top">
        <div className="card range-panel">
          <label htmlFor="weekly-range">
            <span>STUDY TIME PER WEEK {whatIf ? "(WHAT-IF)" : "(YOUR SETTINGS)"}</span>
            <strong>{formatMinutes(weekly)}</strong>
          </label>
          <input
            id="weekly-range"
            type="range"
            min={0}
            max={Math.max(2400, savedTotal)}
            step={30}
            value={weekly}
            onChange={(e) => setWeekly(Number(e.target.value))}
            aria-valuetext={`${formatMinutes(weekly)} per week`}
          />
          <div className="range-markers"><span>0h</span><span>{formatMinutes(Math.max(2400, savedTotal) / 2)}</span><span>{formatMinutes(Math.max(2400, savedTotal))}</span></div>
          {whatIf ? (
            <div style={{ display: "flex", gap: 9, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" className="btn small primary" onClick={saveAvailability}><Save className="ic" aria-hidden="true" /> Save this availability</button>
              <button type="button" className="btn small ghost" onClick={() => setWeekly(savedTotal)}>Reset</button>
            </div>
          ) : null}
        </div>
        <div className="card range-summary" aria-live="polite">
          <div className="label">Study time before {formatDateTime(scenario.lastDeadline, plan.timezone)}</div>
          <strong>{formatMinutes(scenario.availableBeforeDeadlineMinutes)}</strong>
          <p>
            {loading
              ? "Recomputing…"
              : scenario.requiredMinutes === 0
                ? "No upcoming work to plan."
                : scenario.feasible
                  ? `${scenario.title} needs ${formatMinutes(scenario.requiredMinutes)} and fits before its deadlines.`
                  : `${scenario.title} needs ${formatMinutes(scenario.requiredMinutes)}: short by ${formatMinutes(scenario.shortfallMinutes)} before its deadlines.`}
          </p>
        </div>
      </div>

      <div className="scenario-grid" role="group" aria-label="Recovery routes">
        {plan.scenarios.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`scenario${s.key === selected ? " selected" : ""}`}
            aria-pressed={s.key === selected}
            onClick={() => setSelected(s.key)}
          >
            <span className="scenario-head">
              <span className={`scenario-icon ${s.key}`} aria-hidden="true">{(() => { const Icon = ICON[s.key]; return <Icon className="ic" />; })()}</span>
              {s.key === recommended ? <Chip tone="good">Recommended</Chip> : null}
            </span>
            <span className="scenario-title">{s.title}</span>
            <span className={`scenario-status ${s.requiredMinutes === 0 ? "" : s.feasible ? "ok" : "short"}`}>
              {s.requiredMinutes === 0 ? "Nothing to plan" : s.feasible ? "Fits your time" : `Short by ${formatMinutes(s.shortfallMinutes)}`}
            </span>
            <span className={`scenario-number ${s.feasible ? "ok" : s.coveragePercent >= 60 ? "tight" : "short"}`}>{s.coveragePercent}%</span>
            <span className="scenario-meta">
              {s.feasible ? `${formatMinutes(s.scheduledMinutes)} of ${formatMinutes(s.requiredMinutes)}` : `${formatMinutes(s.requiredMinutes)} required`} · {s.items.length} item{s.items.length === 1 ? "" : "s"}
              {s.tasks.length ? ` · ≈${formatMinutes(perStudyDay(s.tasks))} per study day` : ""}
            </span>
            <RouteTimeline tasks={s.tasks} items={s.items} timezone={plan.timezone} start={plan.horizon.start} />
            <span className="scenario-sub">{s.description}</span>
          </button>
        ))}
      </div>

      <div className="lab-footer">
        <div className="card task-list">
          <div className="split-head"><h3>Exact changes before approval</h3><Chip>Draft · not saved</Chip></div>
          <ul className="exact-changes" aria-label="Exact changes before approval">
            <li><span className="ec add" aria-hidden="true">+</span><strong>{scenario.tasks.length} study block{scenario.tasks.length === 1 ? "" : "s"}</strong><span>will be added ({formatMinutes(scenario.scheduledMinutes)})</span></li>
            <li><span className="ec remove" aria-hidden="true">−</span><strong>{currentPlan?.todo ?? 0} unfinished block{currentPlan?.todo === 1 ? "" : "s"}</strong><span>{currentPlan?.todo ? "of your current plan will be replaced" : "will be removed"}</span></li>
            <li><span className="ec keep" aria-hidden="true"><Check className="ic" /></span><strong>{currentPlan?.completed ?? 0} completed block{currentPlan?.completed === 1 ? "" : "s"}</strong><span>stay in your history</span></li>
          </ul>
          <h4 className="route-items-head">{scenario.title}: what gets scheduled</h4>
          {scenario.items.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>Add upcoming assignments in the knowledge vault to plan a route.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Items in this route">
              {scenario.items.map((item) => {
                const Icon = item.status === "scheduled" ? CheckCircle2 : item.status === "partial" ? CircleDashed : CircleSlash;
                return (
                  <li key={item.id} className="task-item">
                    <span style={{ minWidth: 0 }}>
                      <Icon className="ic" aria-hidden="true" style={item.status === "scheduled" ? undefined : { color: "var(--warn)" }} />
                      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                        <span style={{ overflowWrap: "anywhere" }}>{item.title}</span>
                        <span className="muted" style={{ fontSize: 10 }}>
                          {courseNames[item.courseId] ?? "Course"} · {item.tier}
                          {item.deadline ? ` · due ${formatDateTime(item.deadline, plan.timezone)}` : ""}
                          {item.status !== "scheduled" ? ` · ${formatMinutes(item.unscheduledMinutes)} won't fit` : ""}
                        </span>
                      </span>
                    </span>
                    <b>{item.minutes} min</b>
                  </li>
                );
              })}
            </ul>
          )}
          {error ? <div style={{ marginTop: 12 }}><Notice tone="danger" title={error} /></div> : null}
          <div className="gallery-meta">
            <span className="muted" style={{ fontSize: 11 }}>
              {whatIf ? "Save the what-if availability to approve with it." : scenario.feasible ? "Nothing is saved until you approve." : "Infeasible routes can't be approved."}
            </span>
            <button type="button" className="btn primary" onClick={review} disabled={!scenario.feasible || whatIf || loading || drafting}>
              {drafting ? <span className="spinner" aria-hidden="true" /> : null} Review and approve <ArrowRight className="ic" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="card card-inner">
          <div className="split-head"><h3>How this is calculated</h3><AlertTriangle className="ic" aria-hidden="true" style={{ color: "var(--accent)" }} /></div>
          <p style={{ fontSize: 12, lineHeight: 1.85, color: "var(--muted)" }}>
            “Recommended” is the most complete route that still fits your time. Your daily windows start at your study time in {plan.timezone}. Work is placed earliest-deadline-first in blocks of up to 90 minutes with
            10-minute breaks. If that can&apos;t fit everything before each deadline, no other order of the same blocks can — so the shortfall is real.
          </p>
          <div className="mini-activity" style={{ marginTop: 15 }}><div className="activity-dot" /><div><strong>Understand capacity</strong><p>Required work is compared to real availability.</p></div></div>
          <div className="mini-activity"><div className="activity-dot rose" /><div><strong>Never hide shortfalls</strong><p>Unrealistic plans are flagged and can&apos;t be approved.</p></div></div>
        </div>
      </div>
      {proposal ? <ApprovalDialog key={proposal.id} proposal={proposal} timezone={plan.timezone} courseNames={courseNames} currentPlan={currentPlan} onClose={() => setProposal(null)} /> : null}
    </>
  );
}
