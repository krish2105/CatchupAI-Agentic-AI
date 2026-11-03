"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { UniverseNode } from "./types";

export type WorldPalette = {
  grassLow: string; grassHigh: string; autumn: string; rock: string; rockDark: string; trunk: string;
  canopy: string; canopy2: string; path: string; stone: string; selected: string; status: Record<string, string>;
};

export const WORLD = {
  light: { grassLow: "#b9c9a8", grassHigh: "#5f9e5a", autumn: "#d8a94a", rock: "#b7a68c", rockDark: "#8c7b64", trunk: "#7a5a3c", canopy: "#4f8a52", canopy2: "#6fae68", path: "#c99a3c", stone: "#e9e4d6", selected: "#1c3328", status: {} },
  dark: { grassLow: "#5d7a68", grassHigh: "#4fae7a", autumn: "#c89a46", rock: "#6b7a70", rockDark: "#56645b", trunk: "#7a5c40", canopy: "#3f8a60", canopy2: "#56a576", path: "#e5bc6a", stone: "#a9b8ae", selected: "#ecf3ec", status: {} },
} satisfies Record<"light" | "dark", WorldPalette>;

/** Central landmark: a great tree on a floating rock (the student's whole learning world). */
export function GreatTree({ p }: { p: WorldPalette }) {
  return (
    <group position={[0, -0.25, 0]}>
      <mesh position={[0, -0.32, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.7, 0.9, 8]} />
        <meshStandardMaterial color={p.rockDark} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.72, 0.7, 0.14, 10]} />
        <meshStandardMaterial color={p.grassHigh} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.07, 0.11, 0.8, 7]} />
        <meshStandardMaterial color={p.trunk} roughness={0.9} flatShading />
      </mesh>
      {[[0, 1.05, 0, 0.42], [-0.28, 0.9, 0.08, 0.3], [0.27, 0.92, -0.05, 0.32], [0.05, 1.32, 0.04, 0.28]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? p.canopy2 : p.canopy} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Pine({ position, scale = 1, color }: { position: [number, number, number]; scale?: number; color: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.16, 0]}>
        <coneGeometry args={[0.09, 0.3, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.06, 5]} />
        <meshStandardMaterial color="#6b4f35" />
      </mesh>
    </group>
  );
}

/** A rounded broadleaf tree: grown by completing a study block (distinct from the document pines). */
function Grown({ position, scale, p }: { position: [number, number, number]; scale: number; p: WorldPalette }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.012, 0.018, 0.1, 5]} />
        <meshStandardMaterial color={p.trunk} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <icosahedronGeometry args={[0.065, 0]} />
        <meshStandardMaterial color={p.canopy2} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

export const MAX_GROWN_TREES = 12;

/**
 * One course as a floating island. Grass lushness = real plan progress (muted without a plan); overdue required
 * work tints it autumn gold. Pines = documents, stone markers = assignments, coloured by their own status.
 * Round trees on the rim = completed study blocks (up to 12), so the forest grows as the student works.
 */
export function Island({ node, p, statusColor, selected, hovered, size }: { node: UniverseNode; p: WorldPalette; statusColor: Record<string, string>; selected: boolean; hovered: boolean; size: number }) {
  const grass = useMemo(() => {
    const c = new THREE.Color(p.grassLow).lerp(new THREE.Color(p.grassHigh), node.progress === null ? 0.35 : 0.35 + (node.progress / 100) * 0.65);
    if (node.status === "needs_work") c.lerp(new THREE.Color(p.autumn), 0.45);
    return `#${c.getHexString()}`;
  }, [node.progress, node.status, p]);
  const docs = node.topics.filter((t) => t.kind === "document");
  const tasks = node.topics.filter((t) => t.kind === "assignment");
  const ring = (count: number, radius: number, offset: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / Math.max(count, 1)) * Math.PI * 2 + offset;
      return [Math.cos(a) * radius, Math.sin(a) * radius] as const;
    });
  return (
    <group scale={size * (hovered ? 1.06 : 1)}>
      <mesh position={[0, -0.36, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.5, 0.72, 7]} />
        <meshStandardMaterial color={p.rock} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.54, 0.5, 0.1, 9]} />
        <meshStandardMaterial color={grass} roughness={0.85} flatShading emissive={selected ? grass : "#000000"} emissiveIntensity={selected ? 0.18 : 0} />
      </mesh>
      {ring(Math.min(Math.max(docs.length, 2), 7), 0.3, 0.4).map(([x, z], i) => (
        <Pine key={`pine-${i}`} position={[x, 0.05, z]} scale={0.9 + (i % 3) * 0.15} color={docs[i] ? (docs[i].status === "on_track" ? p.canopy : p.grassLow) : p.canopy2} />
      ))}
      {ring(Math.min(node.grown ?? 0, MAX_GROWN_TREES), 0.46, 0.15).map(([x, z], i) => (
        <Grown key={`grown-${i}`} position={[x, 0.05, z]} scale={0.85 + (i % 4) * 0.1} p={p} />
      ))}
      {tasks.slice(0, 6).map((t, i) => {
        const [x, z] = ring(Math.min(tasks.length, 6), 0.16, 1.1)[i];
        return (
          <mesh key={t.id} position={[x, 0.09, z]}>
            <dodecahedronGeometry args={[0.055, 0]} />
            <meshStandardMaterial color={statusColor[t.status] ?? p.stone} roughness={0.7} flatShading />
          </mesh>
        );
      })}
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color={statusColor[node.status]} />
      </mesh>
      {selected ? (
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.008, 6, 64]} />
          <meshBasicMaterial color={p.path} transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Dashed curve joining islands in order of their next deadline (not a prerequisite claim). */
export function DeadlinePath({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const line = useMemo(() => {
    if (points.length < 2) return null;
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y += 0.35;
      curvePoints.push(...new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(24));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const material = new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.85 });
    const l = new THREE.Line(geometry, material);
    l.computeLineDistances();
    return l;
  }, [points, color]);
  return line ? <primitive object={line} /> : null;
}

/** Student-confirmed prerequisite links: a solid arc from the foundation island to the course built on it. */
export function PrereqPaths({ pairs, color }: { pairs: [THREE.Vector3, THREE.Vector3][]; color: string }) {
  const lines = useMemo(
    () =>
      pairs.map(([from, to]) => {
        const a = from.clone().add(new THREE.Vector3(0, 0.12, 0));
        const b = to.clone().add(new THREE.Vector3(0, 0.12, 0));
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y += 0.7;
        const geometry = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(32));
        return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      }),
    [pairs, color],
  );
  return <>{lines.map((l, i) => <primitive key={i} object={l} />)}</>;
}
