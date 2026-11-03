"use client";

import SceneHost from "@/components/three/scene-host";
import type { UniverseGraph } from "@/components/three/types";

/** Decorative illustration only: these nodes are product concepts, not student data. */
const CONCEPT_GRAPH: UniverseGraph = {
  nodes: [
    { id: "knowledge", label: "Your knowledge", status: "on_track", progress: null, summary: "", href: "#", topics: [] },
    { id: "reasoning", label: "Agent reasoning", status: "mastered", progress: null, summary: "", href: "#", topics: [] },
    { id: "plan", label: "Recovery plan", status: "needs_work", progress: null, summary: "", href: "#", topics: [] },
  ],
};

export default function LandingOrb() {
  return <SceneHost graph={CONCEPT_GRAPH} label="Decorative illustration of the CatchUp AI knowledge orb" compact />;
}
