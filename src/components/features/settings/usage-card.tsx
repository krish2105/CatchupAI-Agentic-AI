import { Gauge } from "lucide-react";
import type { UsageRow } from "@/lib/db/usage";

/** Usage and fair-use limits, from the student's own records (counts only). */
export default function UsageCard({ rows, isAnonymous }: { rows: UsageRow[]; isAnonymous: boolean }) {
  return (
    <section className="card card-inner usage-card" aria-labelledby="usage-head">
      <div className="split-head"><h3 id="usage-head"><Gauge className="ic" aria-hidden="true" /> Usage and limits</h3></div>
      <p className="muted">{isAnonymous ? "Demo accounts have smaller limits. Create a full account for more." : "Fair-use limits keep the service fast and costs predictable."}</p>
      <ul aria-label="Usage against limits">
        {rows.map((r) => {
          const pct = Math.min(100, Math.round((r.used / r.limit) * 100));
          return (
            <li key={r.label}>
              <span className="usage-label">{r.label}</span>
              <span className="usage-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} className={pct >= 80 ? "high" : undefined} /></span>
              <span className="usage-num">{r.used} / {r.limit} <small>{r.window}</small></span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
