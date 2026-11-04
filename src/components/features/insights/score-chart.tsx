"use client";

import { useState } from "react";
import type { ScorePoint } from "@/lib/insights/recovery-score";

/** Single-series line of the daily recovery score (0–100%). Days without due blocks are gaps, not zeros. */
export default function ScoreChart({ points }: { points: ScorePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 170;
  const pad = { top: 12, right: 10, bottom: 26, left: 36 };
  const slot = (W - pad.left - pad.right) / points.length;
  const x = (i: number) => pad.left + i * slot + slot / 2;
  const y = (s: number) => pad.top + (H - pad.top - pad.bottom) * (1 - s / 100);
  const label = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  // Break the line wherever a day has no score.
  const segments: string[] = [];
  let current = "";
  points.forEach((p, i) => {
    if (p.score === null) { if (current) segments.push(current); current = ""; return; }
    current += `${current ? "L" : "M"}${x(i)},${y(p.score)}`;
  });
  if (current) segments.push(current);
  const latest = [...points].reverse().find((p) => p.score !== null);

  return (
    <div style={{ position: "relative" }}>
      <svg className="bar-chart score-chart" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Daily recovery score, last ${points.length} days.${latest ? ` Latest ${latest.score}%.` : ""} Table below.`}>
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line className="chart-gridline" x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text className="chart-label" x={pad.left - 6} y={y(t) + 3} textAnchor="end">{t}%</text>
          </g>
        ))}
        {segments.map((d) => <path key={d} className="score-line" d={d} />)}
        {points.map((p, i) => (
          <g key={p.date} tabIndex={p.score === null ? -1 : 0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} role="img" aria-label={`${label(p.date)}: ${p.score === null ? "no blocks due yet" : `${p.score}%, ${p.done} of ${p.due} blocks`}`}>
            <rect className="hit" x={pad.left + i * slot} y={pad.top} width={slot} height={H - pad.top - pad.bottom} />
            {p.score !== null ? <circle className="score-dot" cx={x(i)} cy={y(p.score)} r={hover === i ? 5 : 4} /> : null}
            {i % 2 === 1 || points.length <= 7 ? <text className="chart-label" x={x(i)} y={H - 8} textAnchor="middle">{label(p.date)}</text> : null}
          </g>
        ))}
      </svg>
      {hover !== null ? (
        <div className="chart-tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(points[hover].score ?? 0) / H) * 100}%` }} role="status">
          <strong>{label(points[hover].date)}</strong> · {points[hover].score === null ? "no blocks due yet" : `${points[hover].score}% · ${points[hover].done} of ${points[hover].due} blocks done`}
        </div>
      ) : null}
      <details style={{ marginTop: 10 }}>
        <summary className="text-link" style={{ cursor: "pointer", display: "inline-flex" }}>Show as table</summary>
        <table className="data-table">
          <thead><tr><th scope="col">Day</th><th scope="col">Score</th><th scope="col">Done / due</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.date}><td>{label(p.date)}</td><td>{p.score === null ? "—" : `${p.score}%`}</td><td>{p.done} / {p.due}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
