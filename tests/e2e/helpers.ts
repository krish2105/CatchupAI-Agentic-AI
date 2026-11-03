import type { Page } from "@playwright/test";

export const APP_PATHS = ["/dashboard", "/universe", "/assistant", "/recovery", "/courses", "/planner", "/quizzes", "/insights", "/focus", "/settings"] as const;

export type Prefs = { theme?: "light" | "dark" | "system"; motion?: "system" | "reduce" | "full"; threeD?: boolean };

/** Seed appearance preferences before any page script runs (mirrors src/lib/preferences). */
export async function seedPrefs(page: Page, prefs: Prefs) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("catchup-prefs", JSON.stringify(value));
  }, prefs);
}
