import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, CircleDashed, Target } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/ui/primitives";
import type { TrackerData } from "@/lib/db/tracker";
import type { TrackerRow, TrackerStatus } from "@/lib/insights/tracker";
import { formatDateTime, formatMinutes } from "@/lib/time";

export const STATUS: Record<TrackerStatus, { label: string; Icon: typeof Target; tone: "good" | "warn" | "danger" | undefined }> = {
  overdue: { label: "Past due", Icon: AlertTriangle, tone: "danger" },
  at_risk: { label: "Not fully planned", Icon: CircleAlert, tone: "warn" },
  unplanned: { label: "Not planned yet", Icon: CircleDashed, tone: undefined },
  on_track: { label: "On track", Icon: Target, tone: "good" },
  done: { label: "Done", Icon: CheckCircle2, tone: "good" },
};

function action(row: TrackerRow) {
  if (row.status === "overdue") return { href: "/recovery?replan=1", text: "Replan" };
  if (row.status === "at_risk" || row.status === "unplanned") return { href: "/recovery", text: "Plan it" };
  if (row.status === "on_track") return { href: "/planner?view=month", text: "See schedule" };
  return null;
}

/**
 * Recovery tracker: progress towards each assignment from completed study blocks, with an honest state and
 * the next step. No streaks, points or rankings (see docs/DECISIONS.md ADR-065): one goal at a time, a fresh
 * week every Monday, and missed work leads to a replan, not a penalty.
 */
export default function RecoveryTracker({ data, timezone }: { data: TrackerData; timezone: string }) {
  const { rows, week, courseNames } = data;
  const open = rows.filter((r) => r.status !== "done");
  const count = (s: TrackerStatus) => rows.filter((r) => r.status === s).length;
  return (
    <section className="card card-inner tracker section-space" id="tracker" aria-labelledby="tracker-title">
      <div className="split-head">
        <h2 id="tracker-title" className="trace-h2">Recovery tracker</h2>
        {rows.length ? <Chip tone={count("overdue") || count("at_risk") ? "warn" : "good"}>{count("on_track") + count("done")} of {rows.length} on track or done</Chip> : null}
      </div>
      <p className="muted">Progress on each assignment, from the study blocks you&apos;ve completed. Scheduled time only counts if it ends before the deadline.</p>
      <p className="tracker-week">
        <b>This week</b> (from {formatDateTime(`${week.weekStart}T12:00:00Z`, "UTC", { hour: undefined, minute: undefined })}): {formatMinutes(week.doneMinutes)} of {formatMinutes(week.plannedMinutes)} planned study done
        {week.focusMinutes ? ` · ${week.focusMinutes} focus minutes` : ""}
        {week.missedBlocks ? <> · {week.missedBlocks} block{week.missedBlocks === 1 ? "" : "s"} not done yet, <Link href="/recovery?replan=1">replan around {week.missedBlocks === 1 ? "it" : "them"}</Link></> : null}
        . Each Monday starts a fresh week.
      </p>
      {rows.length === 0 ? (
        <p className="muted">No assignments yet. <Link href="/courses">Add one in the Knowledge vault</Link> to track it here.</p>
      ) : (
        <ul className="tracker-rows" aria-label="Assignments, most in need of attention first">
          {rows.map((r) => {
            const s = STATUS[r.status];
            const next = action(r);
            return (
              <li key={r.id} data-status={r.status}>
                <div className="tracker-row-head">
                  <s.Icon className={`ic tracker-icon ${r.status}`} aria-hidden="true" />
                  <strong>{r.title}</strong>
                  <Chip tone={s.tone}>{s.label}</Chip>
                </div>
                <p className="muted">{courseNames[r.courseId] ?? "Course"} · due {formatDateTime(r.dueAt, timezone)}{r.required ? "" : " · optional"}</p>
                <progress max={100} value={r.percent} aria-label={`${r.title}: ${r.percent}% done`} />
                <p>
                  {r.status === "done" && r.doneMinutes === 0 ? "Marked complete" : `${formatMinutes(r.doneMinutes)} of ${formatMinutes(r.estimatedMinutes)} done`}
                  {r.status !== "done" && r.scheduledMinutes ? ` · ${formatMinutes(r.scheduledMinutes)} scheduled before the deadline` : ""}
                  {r.status !== "done" && r.shortMinutes ? ` · ${formatMinutes(r.shortMinutes)} not planned yet` : ""}
                  {r.checklist ? ` · rubric checklist ${r.checklist.done} of ${r.checklist.total}` : ""}
                </p>
                {next ? <Link className="text-link tracker-next" href={next.href}>{next.text} <ArrowRight className="ic" aria-hidden="true" /></Link> : null}
              </li>
            );
          })}
        </ul>
      )}
      {open.length === 0 && rows.length ? <p className="muted">Everything is done or on track.</p> : null}
    </section>
  );
}

/** Mission Control summary: how many deadlines are on track, at risk, not planned or past due. */
export function TrackerGlance({ rows }: { rows: TrackerRow[] }) {
  const open = rows.filter((r) => r.status !== "done");
  if (!open.length) return null;
  const items = (["overdue", "at_risk", "unplanned", "on_track"] as const).map((s) => ({ s, n: open.filter((r) => r.status === s).length })).filter((x) => x.n);
  return (
    <section className="card nf-panel tracker-glance" aria-labelledby="glance-head">
      <h2 id="glance-head">Deadline tracker</h2>
      <ul aria-label="Open assignments by state">
        {items.map(({ s, n }) => {
          const { Icon, label } = STATUS[s];
          return <li key={s} data-status={s}><Icon className={`ic tracker-icon ${s}`} aria-hidden="true" /> <b>{n}</b> {label.toLowerCase()}</li>;
        })}
      </ul>
      <Link className="text-link" href="/insights#tracker">Open the tracker <ArrowRight className="ic" aria-hidden="true" /></Link>
    </section>
  );
}
