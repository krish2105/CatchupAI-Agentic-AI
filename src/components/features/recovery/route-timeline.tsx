import type { ItemOutcome, PlannedTask } from "@/lib/planner/engine";
import { formatMinutes } from "@/lib/time";

/**
 * Seven local days of a route at a glance: scheduled minutes per day as bars, and deadline markers on the
 * day an item is due (amber when that item doesn't fully fit). Purely derived from the engine's output.
 */
export default function RouteTimeline({ tasks, items, timezone, start }: { tasks: PlannedTask[]; items: ItemOutcome[]; timezone: string; start: string }) {
  const key = (iso: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(iso));
  const days = Array.from({ length: 7 }, (_, i) => {
    const at = Date.parse(start) + i * 86400_000;
    const k = key(at);
    return {
      k,
      label: new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "narrow" }).format(new Date(at)),
      full: new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", day: "numeric", month: "short" }).format(new Date(at)),
      minutes: tasks.filter((t) => key(t.startsAt) === k).reduce((s, t) => s + t.minutes, 0),
      due: items.filter((it) => it.deadline && key(it.deadline) === k),
    };
  });
  const max = Math.max(60, ...days.map((d) => d.minutes));
  const summary = days.map((d) => `${d.full}: ${formatMinutes(d.minutes)} scheduled${d.due.length ? `, due: ${d.due.map((x) => `${x.title}${x.status !== "scheduled" ? " (doesn't fully fit)" : ""}`).join(", ")}` : ""}`).join(". ");
  return (
    <div className="route-timeline" role="img" aria-label={`Next 7 days. ${summary}.`}>
      {days.map((d) => (
        <div key={d.k} className="rt-day" title={`${d.full} · ${formatMinutes(d.minutes)}`}>
          <div className="rt-track">
            <span className="rt-bar" style={{ height: `${(d.minutes / max) * 100}%` }} />
          </div>
          <span className="rt-label">{d.label}</span>
          <span className="rt-due">
            {d.due.map((x) => <i key={x.id} className={x.status === "scheduled" ? "ok" : "short"} />)}
          </span>
        </div>
      ))}
    </div>
  );
}
