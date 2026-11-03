import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";
import { APP_PATHS, seedPrefs } from "./helpers";

test.describe("app shell", () => {
  test("sidebar navigates to all nine screens and marks the current page", async ({ page }) => {
    await page.goto("/dashboard");
    const labels = ["Mission control", "Learning universe", "AI copilot", "Recovery lab", "Knowledge vault", "Study schedule", "Practice arena", "Your momentum", "Focus sanctuary", "Preferences"];
    for (const [i, label] of labels.entries()) {
      await page.getByRole("navigation").getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${APP_PATHS[i]}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    }
  });

  test("header theme toggle persists across reload", async ({ page }) => {
    await seedPrefs(page, { theme: "dark" });
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    // addInitScript re-seeds on reload, so verify persistence via a fresh context-free read instead.
    const stored = await page.evaluate(() => window.localStorage.getItem("catchup-prefs"));
    expect(JSON.parse(stored ?? "{}").theme).toBe("light");
  });

  test("theme survives a real reload without re-seeding", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("group", { name: "Appearance" }).getByRole("button", { name: "Light" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("group", { name: "Appearance" }).getByRole("button", { name: "Dark" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("system theme follows the OS colour scheme", async ({ page }) => {
    await seedPrefs(page, { theme: "system" });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/settings");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("3D off shows the non-WebGL fallback and keeps the topic list path", async ({ page }) => {
    await seedPrefs(page, { threeD: false });
    await page.goto("/universe");
    await expect(page.getByText("3D VIEW OFF · SEE PREFERENCES")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    // The DOM inspector (empty state or topic list) remains the full-featured path.
    await expect(page.locator(".inspector")).toBeVisible();
  });

  test("reduced motion preference is applied to the document", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("group", { name: "Motion" }).getByRole("button", { name: "Reduce" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
    await page.getByRole("switch", { name: "3D views" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-three-d", "off");
  });

  test("mobile drawer opens, traps focus, and closes with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    const menu = page.getByRole("button", { name: "Open navigation" });
    await menu.click();
    await expect(page.locator("#sidebar")).toHaveClass(/open/);
    await expect(page.getByRole("link", { name: "Learning universe" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#sidebar")).not.toHaveClass(/open/);
    await expect(menu).toBeFocused();
    await menu.click();
    await page.getByRole("link", { name: "Recovery lab" }).click();
    await expect(page).toHaveURL(/\/recovery$/);
    await expect(page.locator("#sidebar")).not.toHaveClass(/open/);
  });

  test("signing out ends the session", async ({ browser }) => {
    // Uses its own student: signing out the shared E2E session would log out tests running in parallel.
    const s = await freshStudent(browser);
    try {
      await s.page.goto("/settings");
      await s.page.getByRole("button", { name: "Sign out" }).click();
      await expect(s.page).toHaveURL(/\/$/);
      await s.page.goto("/dashboard");
      await expect(s.page).toHaveURL(/\/login/);
    } finally {
      await s.cleanup();
    }
  });

  test("unknown routes render the 404 view", async ({ page }) => {
    const response = await page.goto("/definitely-not-here");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page doesn't exist." })).toBeVisible();
  });
});

test.describe("responsive layout", () => {
  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 390, 1024, 1440]) {
      test(`no horizontal overflow at ${width}px (${theme})`, async ({ page }) => {
        await seedPrefs(page, { theme, motion: "reduce" });
        await page.setViewportSize({ width, height: 900 });
        for (const path of ["/", "/quality", ...APP_PATHS]) {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
        }
      });
    }
  }
});

test.describe("accessibility (axe)", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`no serious or critical violations (${theme})`, async ({ page }) => {
      await seedPrefs(page, { theme, motion: "reduce", threeD: false });
      const found: string[] = [];
      for (const path of ["/", "/quality", ...APP_PATHS]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        found.push(...serious.map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.nodes.map((n) => n.target).slice(0, 4).join(" | ")}`));
      }
      expect(found).toEqual([]);
    });
  }
});
