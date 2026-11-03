"use client";

import { STATUS_LABEL } from "./types";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DeadlinePath, GreatTree, Island, PrereqPaths, WORLD } from "./nature-world";
import { PALETTES } from "./palette";
import type { SceneController } from "./controller";
import type { UniverseGraph } from "./types";


type SceneProps = {
  graph: UniverseGraph;
  theme: "light" | "dark";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  autoRotate: boolean;
  frameloop: "always" | "demand" | "never";
  showLabels: boolean;
  controller: SceneController;
  compact?: boolean;
};

type LabelRefs = React.RefObject<(HTMLDivElement | null)[]>;


const RING_RADIUS = 2.35;

function layout(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / Math.max(count, 1)) * Math.PI * 2 + Math.PI / 5;
    return new THREE.Vector3(Math.cos(angle) * RING_RADIUS, Math.sin(angle * 2) * 0.28, Math.sin(angle) * RING_RADIUS);
  });
}

function Universe({ graph, theme, selectedId, onSelect, autoRotate, showLabels, controller, compact, labels }: Omit<SceneProps, "frameloop"> & { labels: LabelRefs }) {
  const palette = PALETTES[theme];
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const positions = useMemo(() => layout(graph.nodes.length), [graph.nodes.length]);
  const invalidate = useThree((state) => state.invalidate);
  const nodeRefs = useRef<(THREE.Group | null)[]>([]);
  const projected = useMemo(() => new THREE.Vector3(), []);
  const frameloop = useThree((state) => state.frameloop);
  // Fit the ring (plus label room) inside the visible frustum width at z=0 for any aspect ratio.
  const viewportWidth = useThree((state) => state.viewport.width);
  const fit = Math.min(1, (viewportWidth / 2 - 0.55) / RING_RADIUS);

  useEffect(() => controller.attach(invalidate), [controller, invalidate]);

  useFrame((_, delta) => {
    const g = group.current;
    const c = controller;
    if (!g) return;
    if (frameloop === "demand") {
      // Reduced motion / paused: snap to the requested orientation, no continuous animation.
      g.rotation.y = c.targetY;
      g.rotation.x = 0.32 + c.targetX;
      return;
    }
    if (autoRotate) c.spin(delta);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, c.targetY, 4, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, 0.32 + c.targetX, 4, delta);
  });

  // Position DOM labels over their nodes after the group transform updates (no React re-render).
  // Default priority: a positive priority would disable R3F's automatic render.
  useFrame((state) => {
    if (!showLabels) return;
    const { width, height } = state.size;
    const camera = state.camera as THREE.PerspectiveCamera;
    const unitsToPx = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    nodeRefs.current.forEach((node, i) => {
      const el = labels.current[i];
      if (!node || !el) return;
      node.getWorldPosition(projected);
      // Place the label centred ABOVE the island, clear of its beacon.
      const distance = camera.position.distanceTo(projected);
      const offset = -((0.78 * fit) / distance) * unitsToPx - el.offsetHeight - 6;
      projected.project(camera);
      const cx = (projected.x * 0.5 + 0.5) * width;
      const cy = (-projected.y * 0.5 + 0.5) * height;
      const w = el.offsetWidth;
      const x = Math.max(8, Math.min(cx - w / 2, width - w - 8));
      const y = Math.max(8, Math.min(cy + offset, height - el.offsetHeight - 8));
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.opacity = projected.z < 1 ? "1" : "0";
    });
  });

  const world = WORLD[theme];
  const islandSize = graph.nodes.length > 6 ? 0.78 : 1;
  const pathPoints = useMemo(
    () =>
      graph.nodes
        .map((n, i) => ({ due: n.nextDueAt ? Date.parse(n.nextDueAt) : Number.POSITIVE_INFINITY, pos: positions[i] }))
        .filter((x) => Number.isFinite(x.due))
        .sort((a, b) => a.due - b.due)
        .map((x) => x.pos.clone().add(new THREE.Vector3(0, 0.05, 0))),
    [graph.nodes, positions],
  );

  const prereqPairs = useMemo(() => {
    const index = new Map(graph.nodes.map((n, i) => [n.id, i]));
    return graph.nodes.flatMap((n, i) => (n.requires ?? []).filter((r) => index.has(r)).map((r) => [positions[index.get(r)!], positions[i]] as [THREE.Vector3, THREE.Vector3]));
  }, [graph.nodes, positions]);

  return (
    <>
      <hemisphereLight args={[theme === "dark" ? "#cfe8dc" : "#fff6dc", theme === "dark" ? "#24382e" : "#7f9a86", theme === "dark" ? 2.2 : 2.1]} />
      <directionalLight position={[4, 6, 3]} intensity={theme === "dark" ? 1.8 : 2.2} color={theme === "dark" ? "#e9eedc" : palette.lightA} />
      <group ref={group} rotation={[0.32, 0, 0]} scale={fit}>
        <GreatTree p={world} />
        <DeadlinePath points={pathPoints} color={world.path} />
        <PrereqPaths pairs={prereqPairs} color={theme === "dark" ? "#86d3cd" : "#21746f"} />
        {graph.nodes.map((node, i) => {
          const isSelected = node.id === selectedId;
          return (
            <group
              key={node.id}
              position={positions[i]}
              ref={(el) => { nodeRefs.current[i] = el; }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(node.id);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                setHovered(node.id);
                document.body.style.cursor = onSelect ? "pointer" : "";
              }}
              onPointerOut={() => {
                setHovered(null);
                document.body.style.cursor = "";
              }}
            >
              <Island node={node} p={world} statusColor={palette.status} selected={isSelected} hovered={node.id === hovered} size={(compact ? 0.85 : 1) * islandSize} />
            </group>
          );
        })}
      </group>
    </>
  );
}

export default function OrbitalScene({ frameloop, ...props }: SceneProps) {
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
    <Canvas
      dpr={[1, 1.5]}
      frameloop={frameloop}
      camera={{ position: [0, 0.6, props.compact ? 6.2 : 6.6], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <Universe {...props} labels={labels} />
    </Canvas>
      {props.showLabels ? (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {props.graph.nodes.map((node, i) => (
            <div key={node.id} ref={(el) => { labels.current[i] = el; }} style={{ position: "absolute", left: 0, top: 0, opacity: 0 }}>
              <div className="scene-label"><strong><span className={`topic-dot ${node.status}`} />{node.label}</strong><small>{node.progress === null ? STATUS_LABEL[node.status] : `${node.progress}% of plan`} · Course island</small></div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
