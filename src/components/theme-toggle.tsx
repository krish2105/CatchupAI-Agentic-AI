"use client";

import { setPreferences, usePreferences } from "@/lib/preferences/store";

export default function ThemeToggle() {
  const { resolvedTheme } = usePreferences();
  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setPreferences({ theme: next })}
      aria-label={`Switch to ${next} theme`}
    >
      <span aria-hidden="true">{resolvedTheme === "dark" ? "☀" : "☾"}</span>
      <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
