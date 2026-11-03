"use client";

import { useSyncExternalStore } from "react";
import { PREFS_KEY } from "./constants";

/**
 * Appearance preferences (theme, motion, 3D) kept in localStorage and mirrored
 * onto <html> data attributes so CSS and the 3D scenes react without a re-fetch.
 * The pre-hydration script in `script.ts` applies the same attributes before paint.
 */
export type ThemePref = "light" | "dark" | "system";
export type MotionPref = "system" | "reduce" | "full";
export type Preferences = { theme: ThemePref; motion: MotionPref; threeD: boolean };
export type ResolvedPreferences = Preferences & { resolvedTheme: "light" | "dark"; reducedMotion: boolean };

export { PREFS_KEY };
export const DEFAULT_PREFS: Preferences = { theme: "system", motion: "system", threeD: true };
const CHANGE_EVENT = "catchup:prefs";

export function parsePrefs(raw: string | null): Preferences {
  if (!raw) return DEFAULT_PREFS;
  try {
    const value = JSON.parse(raw) as Partial<Preferences>;
    return {
      theme: value.theme === "light" || value.theme === "dark" || value.theme === "system" ? value.theme : DEFAULT_PREFS.theme,
      motion: value.motion === "reduce" || value.motion === "full" || value.motion === "system" ? value.motion : DEFAULT_PREFS.motion,
      threeD: typeof value.threeD === "boolean" ? value.threeD : DEFAULT_PREFS.threeD,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(PREFS_KEY);
  } catch {
    return null;
  }
}

function media(query: string): boolean {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

export function resolve(prefs: Preferences): ResolvedPreferences {
  const resolvedTheme = prefs.theme === "system" ? (media("(prefers-color-scheme: light)") ? "light" : "dark") : prefs.theme;
  const reducedMotion = prefs.motion === "system" ? media("(prefers-reduced-motion: reduce)") : prefs.motion === "reduce";
  return { ...prefs, resolvedTheme, reducedMotion };
}

export function applyToDocument(resolved: ResolvedPreferences) {
  const root = document.documentElement;
  root.dataset.theme = resolved.resolvedTheme;
  root.dataset.themePref = resolved.theme;
  root.dataset.motion = resolved.reducedMotion ? "reduce" : "full";
  root.dataset.threeD = resolved.threeD ? "on" : "off";
  root.style.colorScheme = resolved.resolvedTheme;
}

// Snapshot cache: useSyncExternalStore requires a stable reference between unchanged reads.
let cacheKey = "";
let cacheValue: ResolvedPreferences | null = null;

function getSnapshot(): ResolvedPreferences {
  const key = `${readRaw()}|${media("(prefers-color-scheme: light)")}|${media("(prefers-reduced-motion: reduce)")}`;
  if (key !== cacheKey || !cacheValue) {
    cacheKey = key;
    cacheValue = resolve(parsePrefs(readRaw()));
  }
  return cacheValue;
}

const SERVER_SNAPSHOT: ResolvedPreferences = { ...DEFAULT_PREFS, resolvedTheme: "dark", reducedMotion: false };
function getServerSnapshot(): ResolvedPreferences {
  return SERVER_SNAPSHOT;
}

function subscribe(onChange: () => void) {
  const queries = ["(prefers-color-scheme: light)", "(prefers-reduced-motion: reduce)"].map((q) => window.matchMedia(q));
  const handler = () => {
    applyToDocument(getSnapshot());
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  queries.forEach((q) => q.addEventListener("change", handler));
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
    queries.forEach((q) => q.removeEventListener("change", handler));
  };
}

export function setPreferences(patch: Partial<Preferences>) {
  const next = { ...parsePrefs(readRaw()), ...patch };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* private mode: still apply for this page view */
  }
  applyToDocument(resolve(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePreferences(): ResolvedPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
