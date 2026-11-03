"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const orbitalNodes: Array<{ position: [number, number, number]; color: string; scale: number }> = [
  { position: [1.75, 0.18, 0.3], color: "#80dce2", scale: 0.12 },
  { position: [-1.45, 0.88, -0.12], color: "#b5a5ff", scale: 0.16 },
  { position: [0.48, -1.48, 0.16], color: "#ffb49b", scale: 0.11 },
  { position: [-1.03, -1.18, 0.34], color: "#c7f46f", scale: 0.09 },
];

function KnowledgeOrbGeometry({ theme }: { theme: "light" | "dark" }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    const current = group.current.rotation;
    const nextY = current.y + Math.min(delta, 0.05) * 0.12;
    current.y = THREE.MathUtils.lerp(nextY, state.pointer.x * 0.28 + nextY, 0.02);
    current.x = THREE.MathUtils.damp(current.x, state.pointer.y * 0.14, 2, delta);
  });

  return (
    <>
      <ambientLight intensity={1.4} />
      <pointLight position={[2, 3, 4]} intensity={70} color={theme === "dark" ? "#80dce2" : "#3c70be"} />
      <pointLight position={[-3, -2, 2]} intensity={45} color={theme === "dark" ? "#b5a5ff" : "#8973ca"} />
      <group ref={group}>
        <mesh>
          <icosahedronGeometry args={[0.91, 4]} />
          <meshStandardMaterial color={theme === "dark" ? "#354b93" : "#adb2f2"} metalness={0.42} roughness={0.26} emissive={theme === "dark" ? "#142b56" : "#6264b6"} emissiveIntensity={0.25} />
        </mesh>
        <mesh scale={1.085}>
          <icosahedronGeometry args={[0.91, 2]} />
          <meshBasicMaterial color={theme === "dark" ? "#80dce2" : "#5277c4"} wireframe transparent opacity={0.45} />
        </mesh>
        <mesh rotation={[0.95, 0.42, 0.15]}>
          <torusGeometry args={[1.42, 0.012, 8, 110]} />
          <meshBasicMaterial color={theme === "dark" ? "#b5a5ff" : "#705cba"} transparent opacity={0.78} />
        </mesh>
        <mesh rotation={[-0.52, 0.24, -0.7]}>
          <torusGeometry args={[1.76, 0.009, 8, 110]} />
          <meshBasicMaterial color={theme === "dark" ? "#80dce2" : "#3c70be"} transparent opacity={0.54} />
        </mesh>
        {orbitalNodes.map((node, index) => (
          <mesh key={index} position={node.position} scale={node.scale}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial color={node.color} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export default function AgentScene({ theme = "dark" }: { theme?: "light" | "dark" }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 42 }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%" }}
    >
      <KnowledgeOrbGeometry theme={theme} />
    </Canvas>
  );
}
