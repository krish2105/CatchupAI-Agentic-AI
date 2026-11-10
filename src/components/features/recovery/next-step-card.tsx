"use client";

import { Copy, Lightbulb, Plus } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_NAMES, type NextStep } from "@/lib/planner/next-step";
import { formatMinutes } from "@/lib/time";

/** The slider moves in 30-minute steps; rounding the suggestion up keeps it a guaranteed fit. */
export const sliderTotal = (weeklyTotal: number) => Math.ceil(weeklyTotal / 30) * 30;

function dayList(days: { weekday: number; extra: number }[]) {
  const set = days.map((d) => d.weekday).join(",");
  if (set === "0,1,2,3,4,5,6") return "every day";
  if (set === "0,1,2,3,4") return "every weekday";
  const names = days.map((d) => WEEKDAY_NAMES[d.weekday]);
  return `on ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]}`;
}

/** "Why every route is short" plus one practical next step (computed by the planner, never by the AI). */
export default function NextStepCard({ step, currentWeekly, onTryWeekly }: { step: NextStep; currentWeekly: number; onTryWeekly: (total: number) => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="card next-step-card" aria-labelledby="next-step-head">
      <h2 id="next-step-head"><Lightbulb className="ic" aria-hidden="true" /> Why every route is short</h2>
      <p>{step.why}</p>
      {step.kind === "more_time" ? (
        <>
          <p className="next-step-fix">
            <strong>Your next step:</strong> add about {formatMinutes(Math.round((sliderTotal(step.weeklyTotal) - currentWeekly) / step.days.length / 5) * 5)}{" "}
            {dayList(step.days)} ({formatMinutes(sliderTotal(step.weeklyTotal) - currentWeekly)} more a week). Then the deadline-first route fits.
          </p>
          <button type="button" className="btn small primary" onClick={() => onTryWeekly(sliderTotal(step.weeklyTotal))}>
            <Plus className="ic" aria-hidden="true" /> Try {formatMinutes(sliderTotal(step.weeklyTotal))} a week
          </button>
        </>
      ) : (
        <>
          <p className="next-step-fix">
            <strong>Your next step:</strong> even 8 hours of study a day can&apos;t fit &quot;{step.assignmentTitle}&quot; in time, so ask your lecturer for an
            extension. Here&apos;s a request you can edit and send.
          </p>
          <details className="next-step-request">
            <summary>Show the extension request</summary>
            <pre>{step.request}</pre>
          </details>
          <button type="button" className="btn small primary" onClick={() => copy(step.request)}>
            <Copy className="ic" aria-hidden="true" /> {copied ? "Copied" : "Copy extension request"}
          </button>
        </>
      )}
    </section>
  );
}
