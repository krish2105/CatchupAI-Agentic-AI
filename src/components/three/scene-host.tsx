"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePreferences } from "@/lib/preferences/store";
import { SceneController } from "./controller";
import type { UniverseGraph } from "./types";
import { webglAvailable } from "./webgl";

function StaticOrb({ note }: { note?: string }) {
  return (
    <div className="scene-fallback">
      <div className="orb-static" aria-hidden="true" />
      {note ? <div className="hud-label hud-bl">{note}</div> : null}
    </div>
  );
}

const OrbitalScene = dynamic(() => import("./orbital-scene"), { ssr: false, loading: () => <StaticOrb /> });

const noopSubscribe = () => () => {};
const WIDE_QUERY = "(min-width: 900px) and (pointer: fine)";
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export default function SceneHost({
  graph,
  label,
  selectedId,
  onSelect,
  paused = false,
  compact = false,
  showLabels = true,
}: {
  graph: UniverseGraph;
  label: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  paused?: boolean;
  compact?: boolean;
  showLabels?: boolean;
}) {
  const { resolvedTheme, reducedMotion, threeD } = usePreferences();
  const webgl = useSyncExternalStore(noopSubscribe, webglAvailable, () => false);
  // Phones/tablets: render on interaction only (no continuous orbit) to protect battery and GPU.
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
  const host = useRef<HTMLDivElement>(null);
  const [controller] = useState(() => new SceneController());
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threeD, webgl]);

  if (!threeD) return <StaticOrb note="3D VIEW OFF · SEE PREFERENCES" />;
  if (!webgl) return <StaticOrb note="3D UNAVAILABLE IN THIS BROWSER" />;

  const still = reducedMotion || paused || !wide;
  const frameloop = !visible ? "never" : still ? "demand" : "always";
  const nudge = (dy: number, dx: number) => controller.nudge(dy, dx);

  return (
    <div
      ref={host}
      className="scene-host"
      tabIndex={0}
      role="group"
      aria-label={`${label}. Use arrow keys to rotate. The same information is available as a list.`}
      onKeyDown={(event) => {
        const step = 0.25;
        if (event.key === "ArrowLeft") nudge(-step, 0);
        else if (event.key === "ArrowRight") nudge(step, 0);
        else if (event.key === "ArrowUp") nudge(0, -step / 2);
        else if (event.key === "ArrowDown") nudge(0, step / 2);
        else return;
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        if (!drag.current || event.buttons === 0) return;
        nudge((event.clientX - drag.current.x) * 0.008, (event.clientY - drag.current.y) * 0.004);
        drag.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      style={{ touchAction: "pan-y", cursor: "grab" }}
    >
      <OrbitalScene
        graph={graph}
        theme={resolvedTheme}
        selectedId={selectedId}
        onSelect={onSelect}
        autoRotate={!still}
        frameloop={frameloop}
        showLabels={showLabels}
        controller={controller}
        compact={compact}
      />
    </div>
  );
}
