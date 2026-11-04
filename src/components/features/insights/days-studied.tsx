"use client";

import { Check, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { daysStudied } from "@/lib/insights/days-studied";

const KEY = "catchup.insights.daysStudied";

/**
 * Optional "X of the last 7 days" view, off by default. The choice is a per-browser convenience kept in local
 * storage (safe to lose). Shows which days had a completed study block, with rest days built into the aim.
 */
export default function DaysStudied({ days }: { days: { date: string; minutes: number; blocks: number }[] }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      // Read once after mount: local storage isn't available during server rendering.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOn(window.localStorage.getItem(KEY) === "on");
    } catch {
      /* storage blocked: stay off */
    }
  }, []);
  function toggle() {
    const next = !on;
    setOn(next);
    try {
      window.localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* storage blocked: the choice lasts for this visit only */
    }
  }
  const r = daysStudied(days);
  const label = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return (
    <div className="days-studied">
      <button type="button" className="btn small ghost" aria-expanded={on} aria-controls="days-studied-panel" onClick={toggle}>
        {on ? "Hide days studied" : "Show days studied this week"}
      </button>
      <div id="days-studied-panel" hidden={!on}>
        <p className="tracker-week">{r.summary}</p>
        <ol className="days-studied-list" aria-label="The last 7 days">
          {r.days.map((d) => (
            <li key={d.date} data-studied={d.studied}>
              {d.studied ? <Check className="ic" aria-hidden="true" /> : <Minus className="ic" aria-hidden="true" />}
              <span>{label(d.date)}</span>
              <span className="visually-hidden">{d.studied ? `: studied, ${d.minutes} minutes` : ": rest day"}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
