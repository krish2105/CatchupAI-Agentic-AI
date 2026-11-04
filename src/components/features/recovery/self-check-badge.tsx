import { CheckCircle2, CircleAlert, OctagonX } from "lucide-react";
import type { SelfCheck } from "@/lib/planner/self-check";

const VIEW = {
  pass: { tone: "good", Icon: CheckCircle2, label: "Self-check passed" },
  shortfall: { tone: "warn", Icon: CircleAlert, label: "Self-check: shortfall" },
  fail: { tone: "danger", Icon: OctagonX, label: "Self-check failed" },
} as const;

/**
 * Result of the deterministic plan self-check (no overlaps, every block before its deadline, minutes add up,
 * required work covered). The badge opens to show each check and, for a shortfall, exactly what doesn't fit.
 */
export default function SelfCheckBadge({ check, timeFormat }: { check: SelfCheck | null | undefined; timeFormat?: (iso: string) => string }) {
  if (!check) return null;
  const { tone, Icon, label } = VIEW[check.status];
  return (
    <details className="self-check" data-status={check.status}>
      <summary className={`chip ${tone}`} aria-label={`${label}. Show details`}>
        <Icon className="ic" aria-hidden="true" /> {label}
      </summary>
      <div className="self-check-body">
        <p>{check.summary}</p>
        <ul>
          {check.checks.map((c) => (
            <li key={c.id} data-ok={c.ok}>
              {c.ok ? <CheckCircle2 className="ic" aria-hidden="true" /> : <CircleAlert className="ic" aria-hidden="true" />}
              <span><b>{c.label}</b> · {c.ok ? "yes" : "no"}{c.ok ? "" : ` (${c.detail})`}</span>
            </li>
          ))}
        </ul>
        {check.shortfalls.length ? (
          <p className="muted">
            Doesn&apos;t fit: {check.shortfalls.map((s) => `${s.title} (${s.minutes} min${s.deadline && timeFormat ? `, due ${timeFormat(s.deadline)}` : ""})`).join("; ")}. Add study time, move a deadline or pick a lighter route.
          </p>
        ) : null}
        <p className="muted">Checked by a fixed algorithm against the blocks themselves, not by the AI.</p>
      </div>
    </details>
  );
}
