"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
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


const RING_RADIUS = 2.25;

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
      // Place the label centred BELOW the node, clear of the sphere and its selection ring.
      const distance = camera.position.distanceTo(projected);
      const ringRadius = (graph.nodes[i]?.id === selectedId ? 0.34 : 0.22) * fit;
      const offset = (ringRadius / distance) * unitsToPx + 10;
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

  return (
    <>
      <ambientLight intensity={theme === "dark" ? 1.1 : 1.6} />
      <pointLight position={[3, 3, 4]} intensity={60} color={palette.lightA} />
      <pointLight position={[-3, -2, 2]} intensity={40} color={palette.lightB} />
      <group ref={group} rotation={[0.32, 0, 0]} scale={fit}>
        <mesh>
          <icosahedronGeometry args={[0.85, 3]} />
          <meshStandardMaterial color={palette.core} emissive={palette.coreEmissive} emissiveIntensity={0.35} metalness={0.35} roughness={0.3} transparent opacity={0.92} />
        </mesh>
        <mesh scale={1.12}>
          <icosahedronGeometry args={[0.85, 1]} />
          <meshBasicMaterial color={palette.wire} wireframe transparent opacity={0.4} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RING_RADIUS, 0.007, 6, 160]} />
          <meshBasicMaterial color={palette.ringB} transparent opacity={0.5} />
        </mesh>
        <mesh rotation={[1.1, 0.5, 0.2]}>
          <torusGeometry args={[RING_RADIUS * 0.72, 0.006, 6, 140]} />
          <meshBasicMaterial color={palette.ringA} transparent opacity={0.45} />
        </mesh>
        {graph.nodes.map((node, i) => {
          const pos = positions[i];
          const color = palette.status[node.status];
          const isSelected = node.id === selectedId;
          const isHovered = node.id === hovered;
          const scale = (compact ? 0.13 : 0.16) * (isSelected ? 1.35 : isHovered ? 1.15 : 1);
          return (
            <group key={node.id} position={pos} ref={(el) => { nodeRefs.current[i] = el; }}>
              <mesh
                scale={scale}
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
                <sphereGeometry args={[1, 24, 24]} />
                <meshBasicMaterial color={color} />
              </mesh>
              {isSelected ? (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.3, 0.012, 6, 48]} />
                  <meshBasicMaterial color={palette.selected} />
                </mesh>
              ) : null}
              {node.topics.slice(0, 6).map((topic, t) => {
                const a = (t / Math.min(node.topics.length, 6)) * Math.PI * 2;
                return (
                  <mesh key={topic.id} position={[Math.cos(a) * 0.42, Math.sin(a) * 0.18, Math.sin(a) * 0.42]} scale={0.045}>
                    <sphereGeometry args={[1, 10, 10]} />
                    <meshBasicMaterial color={palette.status[topic.status]} />
                  </mesh>
                );
              })}
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
              <div className="scene-label">{node.label}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
