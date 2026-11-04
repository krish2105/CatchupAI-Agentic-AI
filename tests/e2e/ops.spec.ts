import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminDb, freshStudent } from "./admin";

const OWNER = "ops-owner@test.catchup.local";

test("/ops is invisible to students: not-found page and 404 from its APIs", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    await s.page.goto("/ops");
    await expect(s.page.getByRole("heading", { name: "This page doesn't exist." })).toBeVisible();
    await expect(s.page.getByRole("heading", { name: "Operations" })).toHaveCount(0);
    expect((await s.page.request.post("/api/ops/flags", { data: { aiEnabled: false, dailyTokenBudget: 0, note: "hijack" } })).status()).toBe(404);
    expect((await s.page.request.post("/api/ops/errors/0123456789abcdef/resolve")).status()).toBe(404);
    const { data } = await s.db.from("ops_flags").select("ai_enabled, note").eq("id", 1).single();
    expect(data!.note).not.toBe("hijack");
  } finally {
    await s.cleanup();
  }
});

test("the owner sees AI spend, uptime and open errors, and can resolve an error group", async ({ browser }) => {
  const db = adminDb();
  // A previous interrupted run may have left the fixed owner account behind.
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of list.users.filter((u) => u.email === OWNER)) await db.auth.admin.deleteUser(u.id);
  const name = `ProbeOps${Date.now().toString(36)}Error`;
  const fingerprint = Date.now().toString(16).padStart(16, "0").slice(-16);
  await db.from("app_error_groups").insert({ fingerprint, source: "route", path: "/api/courses/:id", error_name: name, message: "row <id> failed for [email]", count: 3 });
  const s = await freshStudent(browser, {}, { email: OWNER });
  try {
    await s.page.goto("/ops");
    await expect(s.page.getByRole("heading", { level: 1, name: "Operations" })).toBeVisible();
    await expect(s.page.getByText(/tokens used today/)).toBeVisible();
    await expect(s.page.getByRole("meter", { name: "Share of today's token budget used" })).toBeVisible();
    await expect(s.page.getByRole("heading", { name: "Uptime checks" })).toBeVisible();

    const errors = s.page.getByRole("list", { name: "Open error groups, most recent first" });
    const row = errors.getByRole("listitem").filter({ hasText: name });
    await expect(row).toContainText("×3");
    await expect(row).toContainText("/api/courses/:id");

    for (const scheme of ["light", "dark"] as const) {
      await s.page.emulateMedia({ colorScheme: scheme });
      await s.page.reload(); // scan the settled theme, not a colour transition
      await expect(s.page.getByRole("heading", { level: 1, name: "Operations" })).toBeVisible();
      const axe = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => v.id).join(", ")}`).toEqual([]);
    }

    await row.getByRole("button", { name: "Resolve" }).click();
    await expect(errors.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
    const { data: resolved } = await db.from("app_error_groups").select("resolved_at").eq("fingerprint", fingerprint).single();
    expect(resolved!.resolved_at).not.toBeNull();

    // Saving keeps AI on and the budget unchanged (the kill switch itself is covered by integration tests,
    // because pausing AI here would affect copilot tests running in parallel).
    const before = (await db.from("ops_flags").select("ai_enabled, daily_token_budget, note").eq("id", 1).single()).data!;
    await s.page.getByLabel("Operator note (optional, shown only here)").fill("e2e check");
    await s.page.getByRole("button", { name: "Save" }).click();
    await expect(s.page.getByText("Saved. AI is on.")).toBeVisible();
    const after = (await db.from("ops_flags").select("ai_enabled, daily_token_budget, note").eq("id", 1).single()).data!;
    expect(after).toEqual({ ai_enabled: before.ai_enabled, daily_token_budget: before.daily_token_budget, note: "e2e check" });
    await db.from("ops_flags").update({ note: before.note }).eq("id", 1);
  } finally {
    await db.from("app_error_groups").delete().eq("fingerprint", fingerprint);
    await s.cleanup();
  }
});
