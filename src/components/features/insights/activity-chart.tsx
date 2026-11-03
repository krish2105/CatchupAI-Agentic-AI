"use client";

import { useState } from "react";
import type { DayBucket } from "@/lib/db/insights";
import { formatMinutes } from "@/lib/time";

/** Single-series bar chart of completed study minutes per day (no legend needed; the title names it). */
export default function ActivityChart({ days }: { days: DayBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 180;
  const pad = { top: 12, right: 8, bottom: 26, left: 36 };
  const max = Math.max(60, ...days.map((d) => d.minutes));
  const niceMax = Math.ceil(max / 30) * 30;
  const slot = (W - pad.left - pad.right) / days.length;
  const barW = Math.max(6, slot - 6);
  const y = (m: number) => pad.top + (H - pad.top - pad.bottom) * (1 - m / niceMax);
  const label = (d: DayBucket) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d.date}T12:00:00Z`));
  const ticks = [0, niceMax / 2, niceMax];

  return (
    <div style={{ position: "relative" }}>
      <svg className="bar-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Completed study minutes per day, last 14 days. Total ${formatMinutes(days.reduce((s, d) => s + d.minutes, 0))}. Table below.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-gridline" x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text className="chart-label" x={pad.left - 6} y={y(t) + 3} textAnchor="end">{formatMinutes(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const h = y(0) - y(d.minutes);
          return (
            <g key={d.date} tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`${label(d)}: ${formatMinutes(d.minutes)}`}>
              <rect className="hit" x={pad.left + i * slot} y={pad.top} width={slot} height={H - pad.top - pad.bottom} />
              {d.minutes > 0 ? <path className="bar" d={`M${x},${y(0)} v${-(h - 4)} q0,-4 4,-4 h${barW - 8} q4,0 4,4 v${h - 4} z`} /> : null}
              {i % 2 === 1 || days.length <= 7 ? <text className="chart-label" x={x + barW / 2} y={H - 8} textAnchor="middle">{label(d)}</text> : null}
            </g>
          );
        })}
      </svg>
      {hover !== null ? (
        <div className="chart-tooltip" style={{ left: `${((pad.left + hover * slot + slot / 2) / W) * 100}%`, top: `${(y(days[hover].minutes) / H) * 100}%` }} role="status">
          <strong>{label(days[hover])}</strong> · {formatMinutes(days[hover].minutes)} · {days[hover].blocks} block{days[hover].blocks === 1 ? "" : "s"}
        </div>
      ) : null}
      <details style={{ marginTop: 10 }}>
        <summary className="text-link" style={{ cursor: "pointer", display: "inline-flex" }}>Show as table</summary>
        <table className="data-table">
          <thead><tr><th scope="col">Day</th><th scope="col">Minutes</th><th scope="col">Blocks</th></tr></thead>
          <tbody>{days.map((d) => <tr key={d.date}><td>{label(d)}</td><td>{d.minutes}</td><td>{d.blocks}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
