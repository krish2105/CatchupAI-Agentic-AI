"use client";

import { useState } from "react";
import { assessCapacity } from "@/lib/planner/capacity";

export default function PlannerPreview() {
  const [availableHours, setAvailableHours] = useState(6);
  const requiredHours = 9;
  const result = assessCapacity(requiredHours * 60, availableHours * 60);

  return (
    <section className="planner-card" aria-labelledby="preview-heading">
      <div className="section-kicker">INTERACTIVE EXAMPLE · SYNTHETIC DATA</div>
      <h2 id="preview-heading">The recovery reality check</h2>
      <p>Change the available time to see the deterministic feasibility calculation. No AI or student database is connected yet.</p>
      <div className="metric-grid">
        <div className="metric"><span>Work estimated</span><strong>{requiredHours}h</strong></div>
        <div className="metric"><span>Time available</span><strong>{availableHours}h</strong></div>
        <div className={`metric ${result.feasible ? "metric-success" : "metric-alert"}`}>
          <span>{result.feasible ? "Extra capacity" : "Time shortfall"}</span>
          <strong>{(result.feasible ? result.spareMinutes : result.shortfallMinutes) / 60}h</strong>
        </div>
      </div>
      <label className="slider-label" htmlFor="available-hours">Available study time: <b>{availableHours} hours</b></label>
      <input
        id="available-hours"
        type="range"
        min="0"
        max="14"
        step="1"
        value={availableHours}
        onChange={(event) => setAvailableHours(Number(event.target.value))}
        aria-valuetext={`${availableHours} hours`}
      />
      <div className="progress-track" aria-label={`${result.coveragePercent}% of estimated work fits in available time`} role="img">
        <div className="progress-fill" style={{ width: `${result.coveragePercent}%` }} />
      </div>
      <p className="planner-insight" aria-live="polite">
        {result.feasible
          ? `All ${requiredHours} estimated hours can fit. A real plan must still check deadlines and schedule conflicts.`
          : `${result.shortfallMinutes / 60} more hours are needed. A real agent should prioritize tasks instead of inventing an impossible timetable.`}
      </p>
    </section>
  );
}
