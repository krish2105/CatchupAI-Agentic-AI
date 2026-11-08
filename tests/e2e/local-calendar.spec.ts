import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

test("local calendar: religious settings off by default, choices persist, Hijri date on the schedule, export without coordinates", async ({ browser }) => {
  const s = await freshStudent(browser);
  const prefs = async () => (await (await s.page.request.get("/api/calendar-prefs")).json()).prefs;
  try {
    await s.page.goto("/settings");
    const card = s.page.getByRole("region", { name: "Local calendar" });
    await expect(card.getByText(/Weeks start on Monday/)).toBeVisible();
    for (const name of ["Friday prayer break", "Prayer-time breaks", "Ramadan mode", "Show Hijri dates"]) {
      await expect(card.getByRole("switch", { name })).toHaveAttribute("aria-checked", "false");
    }
    // Prayer times need a city first; the app never asks for the device's location.
    await expect(card.getByRole("switch", { name: "Prayer-time breaks" })).toBeDisabled();
    await expect(card.getByRole("switch", { name: "Ramadan mode" })).toBeDisabled();

    await card.getByRole("switch", { name: "Friday prayer break" }).click();
    await expect(card.getByRole("switch", { name: "Friday prayer break" })).toHaveAttribute("aria-checked", "true");
    await card.getByRole("switch", { name: "Show Hijri dates" }).click();
    await expect.poll(prefs).toMatchObject({ fridayPrayer: true, showHijri: true });

    await card.getByLabel("City for prayer times").selectOption("dubai");
    await expect.poll(prefs).toMatchObject({ city: "dubai", method: "dubai" });
    await card.getByRole("switch", { name: "Ramadan mode" }).click();
    await expect.poll(prefs).toMatchObject({ ramadanMode: true });
    await card.getByLabel("Reduce daily study by").selectOption("30");
    await card.getByLabel("Start time on Ramadan days").fill("21:30");
    await card.getByRole("button", { name: "Save Ramadan settings" }).click();
    await expect(card.getByText("Ramadan settings saved.")).toBeVisible();
    await expect.poll(prefs).toMatchObject({ ramadanReductionPercent: 30, ramadanStudyStart: "21:30", ramadanStart: null, ramadanEnd: null });

    await s.page.reload();
    const reloaded = s.page.getByRole("region", { name: "Local calendar" });
    await expect(reloaded.getByRole("switch", { name: "Friday prayer break" })).toHaveAttribute("aria-checked", "true");
    await expect(reloaded.getByRole("switch", { name: "Show Hijri dates" })).toHaveAttribute("aria-checked", "true");
    await expect(reloaded.getByRole("switch", { name: "Prayer-time breaks" })).toHaveAttribute("aria-checked", "false");
    await expect(reloaded.getByLabel("City for prayer times")).toHaveValue("dubai");

    await s.page.goto("/planner");
    await expect(s.page.getByText(/^Today:/)).toContainText(/\d{1,2} .+ 14\d\d AH/);

    const exported = await (await s.page.request.get("/api/account/export")).json();
    expect(exported.calendarPreferences[0]).toMatchObject({ friday_prayer: true, show_hijri: true, prayer_city: "dubai", prayer_method: "dubai", ramadan_mode: true });
    expect(JSON.stringify(exported)).not.toMatch(/latitude|longitude/);

    await s.page.goto("/settings");
    for (const scheme of ["light", "dark"] as const) {
      await s.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await s.page.reload();
      await s.page.waitForTimeout(300);
      await expect(s.page.getByRole("region", { name: "Local calendar" })).toBeVisible();
      const axe = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }
  } finally {
    await s.cleanup();
  }
});
