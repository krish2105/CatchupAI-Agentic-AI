"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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

export default function AgentOrb() {
  const [enable3D, setEnable3D] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 900px)");
    const update = () => setEnable3D(!reduced.matches && desktop.matches && webglAvailable());
    update();
    reduced.addEventListener("change", update);
    desktop.addEventListener("change", update);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
    };
  }, []);

  return (
    <div className="orb-frame" aria-hidden="true">
      {enable3D ? <WebGLScene theme={theme} /> : <StaticOrb />}
      <div className="orb-caption">KNOWLEDGE · CLARITY · MOMENTUM</div>
    </div>
  );
}
