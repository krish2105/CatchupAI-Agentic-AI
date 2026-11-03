"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileText, List, Pause, Play, Sparkles, Target, TreePine } from "lucide-react";
import { useState } from "react";
import { usePreferences } from "@/lib/preferences/store";
import SceneHost from "./scene-host";
import { STATUS_LABEL, type UniverseGraph } from "./types";
import { studyOrder } from "@/lib/universe/prerequisites";

export default function UniverseExplorer({ graph }: { graph: UniverseGraph }) {
  const [selectedId, setSelectedId] = useState<string | null>(graph.nodes[0]?.id ?? null);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<"3d" | "list">("3d");
  const { reducedMotion } = usePreferences();
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const title = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? "Course";
  const edges = graph.nodes.flatMap((n) => (n.requires ?? []).map((r) => ({ courseId: n.id, requiresId: r })));
  const order = edges.length ? studyOrder(graph.nodes.map((n) => n.id), edges) : [];
  const buildsOn = selected?.requires ?? [];
  const leadsTo = selected ? graph.nodes.filter((n) => n.requires?.includes(selected.id)).map((n) => n.id) : [];

  return (
    <>
      <div className="universe-toolbar">
        <div className="segmented" role="group" aria-label="Universe view">
          <button type="button" aria-pressed={view === "3d"} onClick={() => setView("3d")}><TreePine className="ic" aria-hidden="true" /> 3D forest</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><List className="ic" aria-hidden="true" /> List</button>
        </div>
        {!reducedMotion && view === "3d" ? (
          <button type="button" className="btn small" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="ic" aria-hidden="true" /> : <Pause className="ic" aria-hidden="true" />}
            {paused ? "Resume orbit" : "Pause orbit"}
          </button>
        ) : null}
      </div>
      <div className="panel-grid">
        <div className="atlas-main">
          <div className="atlas-overline">{view === "3d" ? "DRAG TO ORBIT · ARROW KEYS ROTATE" : "YOUR LEARNING ISLANDS · LIST VIEW"}</div>
          {view === "3d" ? (
            <SceneHost graph={graph} label="3D map of your courses" selectedId={selectedId} onSelect={setSelectedId} paused={paused} />
          ) : (
            <ul className="universe-list" aria-label="Courses and topics">
              {graph.nodes.map((node) => (
                <li key={node.id}>
                  <button type="button" className={`universe-row${node.id === selectedId ? " active" : ""}`} aria-pressed={node.id === selectedId} onClick={() => setSelectedId(node.id)}>
                    <span className={`topic-dot ${node.status}`} aria-hidden="true" />
                    <span className="universe-row-body">
                      <strong>{node.label}</strong>
                      <span>{node.progress === null ? STATUS_LABEL[node.status] : `${node.progress}% of plan blocks done`} · {node.topics.length} landmark{node.topics.length === 1 ? "" : "s"}{node.grown ? ` · ${node.grown} tree${node.grown === 1 ? "" : "s"} grown` : ""}</span>
                      {node.requires?.length ? <span>Builds on {node.requires.map(title).join(", ")}</span> : null}
                      <span className="inspector-meter" aria-hidden="true"><span style={{ width: `${node.progress ?? 0}%` }} /></span>
                    </span>
                  </button>
                </li>
              ))}
              {graph.nodes.length === 0 ? <li className="nf-empty">No courses yet. <Link className="text-link" href="/courses">Create one in the Knowledge vault</Link> and it becomes an island here.</li> : null}
            </ul>
          )}
          <div className="atlas-legend" aria-hidden="true">
            <span className="legend"><i /> On track</span>
            <span className="legend"><i className="pink" /> Needs work</span>
            <span className="legend"><i className="green" /> Completed</span>
            <span className="legend"><i className="muted-dot" /> No plan yet</span>
            <span className="legend"><i className="path-dash" /> Path: next-deadline order</span>
            {edges.length ? <span className="legend"><i className="path-solid" /> Builds on (your links)</span> : null}
          </div>
        </div>
        <div className="card inspector">
          {selected ? (
            <div aria-live="polite">
              <div className="label">Selected island</div>
              <h3>{selected.label}</h3>
              <p>{selected.summary}</p>
              <div className="label" style={{ marginTop: 23 }}>Plan progress</div>
              <div className="inspector-meter"><span style={{ width: `${selected.progress ?? 0}%` }} /></div>
              <p>
                {selected.progress === null ? (
                  "No approved tasks for this course yet."
                ) : (
                  <><strong style={{ color: "var(--text)" }}>{selected.progress}%</strong> of approved tasks completed{selected.grown ? <> · {selected.grown} tree{selected.grown === 1 ? "" : "s"} grown, one per finished block</> : null}</>
                )}
              </p>
              {buildsOn.length || leadsTo.length ? (
                <div className="trail-links">
                  <div className="label" style={{ marginTop: 18 }}>Learning trail</div>
                  {buildsOn.length ? <p>Builds on <strong>{buildsOn.map(title).join(", ")}</strong></p> : null}
                  {leadsTo.length ? <p>Leads to <strong>{leadsTo.map(title).join(", ")}</strong></p> : null}
                </div>
              ) : null}
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
                <Link className="btn primary" href="/quizzes"><ClipboardCheck className="ic" aria-hidden="true" /> Practice this course</Link>
                <Link className="btn" href="/assistant"><Sparkles className="ic" aria-hidden="true" /> Ask copilot</Link>
                <Link className="btn ghost small" href={selected.href}>Open course <ArrowRight className="ic" aria-hidden="true" /></Link>
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
          {order.length > 1 ? (
            <p className="trail-order" aria-label="Suggested study order"><span className="label">Suggested order</span> {order.map(title).join(" → ")}</p>
          ) : null}
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
