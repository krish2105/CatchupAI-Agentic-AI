"use client";

import { Moon, Sun } from "lucide-react";
import { setPreferences, usePreferences } from "@/lib/preferences/store";

/** Header light/dark toggle (Settings additionally offers "System"). */
export default function ThemeButton() {
  const { resolvedTheme } = usePreferences();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  const Icon = resolvedTheme === "dark" ? Sun : Moon;
  return (
    <button type="button" className="theme-btn" onClick={() => setPreferences({ theme: next })} aria-label={`Switch to ${next} theme`}>
      <Icon className="ic" aria-hidden="true" />
      <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
