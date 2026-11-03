"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { usePreferences } from "@/lib/preferences/store";

const WebGLScene = dynamic(() => import("./agent-scene"), { ssr: false });

function StaticOrb() {
  return (
    <div className="static-orb" role="img" aria-label="Abstract glowing knowledge sphere with rings; decorative illustration">
      <div className="static-orb-inner" />
      <div className="static-ring static-ring-one" />
      <div className="static-ring static-ring-two" />
    </div>
  );
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia("(min-width: 900px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export default function AgentOrb() {
  const { resolvedTheme, reducedMotion, threeD } = usePreferences();
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia("(min-width: 900px)").matches, () => false);
  const canRender3D = useSyncExternalStore(() => () => {}, webglAvailable, () => false);
  const enable3D = threeD && !reducedMotion && desktop && canRender3D;

  return (
    <div className="orb-frame" aria-hidden="true">
      {enable3D ? <WebGLScene theme={resolvedTheme} /> : <StaticOrb />}
      <div className="orb-caption">KNOWLEDGE · CLARITY · MOMENTUM</div>
    </div>
  );
}
