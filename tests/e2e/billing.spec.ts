import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

const SECRET = "whsec_e2e_not_a_real_secret"; // must match playwright.config.ts

test("public plans page: students never pay; the Class plan shows no invented price", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1, name: "Students never pay." })).toBeVisible();
    const plans = page.getByRole("list", { name: "Plans" });
    await expect(plans.getByRole("listitem").filter({ hasText: "Student" }).first()).toContainText("Free, always");
    await expect(plans.locator('[data-plan="class"]')).toContainText("Price shown at checkout"); // no STRIPE_PRICE_CLASS_LABEL set
    await expect(plans.locator('[data-plan="class"]')).toContainText("Up to 300 members");
    await expect(page.getByText("Stripe test mode")).toBeVisible();
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.reload();
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => v.id).join(", ")}`).toEqual([]);
    }
  } finally {
    await context.close();
  }
});

test("admin billing card: Free → verified Stripe webhook → Class plan with more seats; bad signatures are refused", async ({ browser }) => {
  const s = await freshStudent(browser);
  try {
    const { id: orgId } = await (await s.page.request.post("/api/org", { data: { name: "E2E Billing School" } })).json();
    await s.page.goto("/org");
    const card = s.page.getByRole("region", { name: "Plan and seats" });
    await expect(card).toContainText("Free plan");
    await expect(card).toContainText("1 of 40 seats used");
    await expect(card.getByRole("button", { name: "Upgrade to Class (300 seats)" })).toBeVisible();
    await expect(card.getByRole("meter", { name: "Seats used: 1 of 40" })).toBeVisible();

    const now = Math.floor(Date.now() / 1000);
    const event = { id: `evt_e2e_${orgId.slice(0, 8)}_${now}`, type: "customer.subscription.created", created: now, data: { object: { id: `sub_e2e_${orgId.slice(0, 8)}`, customer: `cus_e2e_${orgId.slice(0, 8)}`, status: "active", current_period_end: now + 30 * 86400, metadata: { org_id: orgId } } } };
    const body = JSON.stringify(event);
    const sign = (secret: string) => `t=${now},v1=${createHmac("sha256", secret).update(`${now}.${body}`).digest("hex")}`;

    const anon = await s.page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } });
    const bad = await anon.request.post("/api/billing/webhook", { headers: { "stripe-signature": sign("whsec_wrong"), "content-type": "application/json" }, data: body });
    expect(bad.status()).toBe(400);
    const ok = await anon.request.post("/api/billing/webhook", { headers: { "stripe-signature": sign(SECRET), "content-type": "application/json" }, data: body });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ received: true, applied: true });
    await anon.close();

    await s.page.reload();
    await expect(card).toContainText("Class plan · active");
    await expect(card).toContainText("1 of 300 seats used");
    await expect(card.getByRole("button", { name: "Manage billing" })).toBeVisible();
  } finally {
    await s.db.from("organizations").delete().ilike("name", "E2E Billing School");
    await s.cleanup();
  }
});
