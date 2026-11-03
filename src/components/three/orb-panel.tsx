"use client";

import SceneHost from "./scene-host";
import type { UniverseGraph } from "./types";

/** Dashboard hero visual: a compact orbit of the student's own courses. */
export default function OrbPanel({ graph }: { graph: UniverseGraph }) {
  return (
    <>
      <SceneHost graph={graph} label="Your courses arranged as a 3D orbit" compact />
      <div className="hud-label hud-tl">KNOWLEDGE IN MOTION</div>
      <div className="hud-hint">
        <i className="live-dot" /> {graph.nodes.length ? `${graph.nodes.length} COURSE${graph.nodes.length === 1 ? "" : "S"} IN ORBIT` : "NO COURSES YET"}
      </div>
    </>
  );
}
