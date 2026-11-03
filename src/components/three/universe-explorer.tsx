"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileText, Pause, Play, Sparkles, Target } from "lucide-react";
import { useState } from "react";
import { usePreferences } from "@/lib/preferences/store";
import SceneHost from "./scene-host";
import { STATUS_LABEL, type UniverseGraph } from "./types";

export default function UniverseExplorer({ graph }: { graph: UniverseGraph }) {
  const [selectedId, setSelectedId] = useState<string | null>(graph.nodes[0]?.id ?? null);
  const [paused, setPaused] = useState(false);
  const { reducedMotion } = usePreferences();
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -8, marginBottom: 14 }}>
        {!reducedMotion ? (
          <button type="button" className="btn small" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="ic" aria-hidden="true" /> : <Pause className="ic" aria-hidden="true" />}
            {paused ? "Resume orbit" : "Pause orbit"}
          </button>
        ) : null}
      </div>
      <div className="panel-grid">
        <div className="atlas-main">
          <div className="atlas-overline">YOUR LEARNING ISLANDS · ONE PER COURSE</div>
          <SceneHost graph={graph} label="3D map of your courses" selectedId={selectedId} onSelect={setSelectedId} paused={paused} />
          <div className="atlas-legend" aria-hidden="true">
            <span className="legend"><i /> On track</span>
            <span className="legend"><i className="pink" /> Needs work</span>
            <span className="legend"><i className="green" /> Completed</span>
            <span className="legend"><i className="muted-dot" /> No plan yet</span>
            <span className="legend"><i className="path-dash" /> Path: next-deadline order</span>
          </div>
        </div>
        <div className="card inspector">
          {selected ? (
            <div aria-live="polite">
              <div className="label">Selected learning world</div>
              <h3>{selected.label}</h3>
              <p>{selected.summary}</p>
              <div className="label" style={{ marginTop: 23 }}>Plan progress</div>
              <div className="inspector-meter"><span style={{ width: `${selected.progress ?? 0}%` }} /></div>
              <p>
                {selected.progress === null ? (
                  "No approved tasks for this course yet."
                ) : (
                  <><strong style={{ color: "var(--text)" }}>{selected.progress}%</strong> of approved tasks completed</>
                )}
              </p>
              {selected.topics.length ? (
                <>
                  <div className="label" style={{ marginTop: 20 }}>Landmarks on this island</div>
                  <ul className="topic-landmarks" aria-label={`Topics in ${selected.label}`}>
                    {selected.topics.slice(0, 8).map((t) => (
                      <li key={t.id}>
                        <span className={`topic-dot ${t.status}`} aria-hidden="true" />
                        {t.kind === "document" ? <FileText className="ic" aria-hidden="true" /> : <Target className="ic" aria-hidden="true" />}
                        <span style={{ overflowWrap: "anywhere" }}>{t.label}</span>
                        <span className="muted">{t.kind === "document" ? (t.status === "on_track" ? "indexed" : "not indexed") : STATUS_LABEL[t.status].toLowerCase()}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                <Link className="btn primary small" href={selected.href}>Open course <ArrowRight className="ic" aria-hidden="true" /></Link>
                <Link className="btn small" href="/quizzes"><ClipboardCheck className="ic" aria-hidden="true" /> Practise</Link>
                <Link className="btn small" href="/assistant"><Sparkles className="ic" aria-hidden="true" /> Ask copilot</Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="label">Your learning universe</div>
              <h3>Empty orbit</h3>
              <p>Create a course in the knowledge vault. Each course becomes a world here, coloured by real plan progress.</p>
              <Link className="btn primary small" style={{ marginTop: 18 }} href="/courses">Create a course</Link>
            </div>
          )}
          {graph.nodes.length ? (
            <div className="topic-list" role="list" aria-label="Learning worlds">
              {graph.nodes.map((node) => (
                <div role="listitem" key={node.id}>
                  <button
                    type="button"
                    className={`topic-button${node.id === selectedId ? " active" : ""}`}
                    aria-pressed={node.id === selectedId}
                    onClick={() => setSelectedId(node.id)}
                  >
                    <span className={`topic-dot ${node.status}`} aria-hidden="true" />
                    <strong>{node.label}</strong>
                    <span>{node.progress === null ? STATUS_LABEL[node.status] : `${node.progress}%`}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
