import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshStudent } from "./admin";

test("organisation admin: email invite accepted by the right account, member removed, rename, audit CSV, delete", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const inviteeEmail = `invitee-${stamp}@test.catchup.local`;
  const owner = await freshStudent(browser);
  const invitee = await freshStudent(browser, {}, { email: inviteeEmail });
  try {
    const name = `E2E Academy ${stamp}`;
    expect((await owner.page.request.post("/api/org", { data: { name } })).status()).toBe(201);
    await owner.page.goto("/org");

    // Invite by email: the one-time link is shown to the admin (no SMTP in tests, so nothing is emailed).
    await owner.page.getByLabel("Email", { exact: true }).fill(inviteeEmail);
    await owner.page.getByLabel("Role", { exact: true }).selectOption("teacher");
    await owner.page.getByRole("button", { name: "Create invite" }).click();
    const link = await owner.page.getByLabel(/Send this link to them/).inputValue();
    expect(link).toMatch(/\/org\?invite=[0-9a-f]{48}$/);

    // The invitee, signed in with that email, accepts and becomes a teacher.
    await invitee.page.goto(new URL(link).pathname + new URL(link).search);
    await invitee.page.getByRole("button", { name: "Accept invite" }).click();
    await expect(invitee.page.getByRole("heading", { name })).toBeVisible();
    await expect(invitee.page.getByText("Teacher", { exact: true }).first()).toBeVisible();

    await owner.page.reload();
    await expect(owner.page.getByRole("table", { name: "Invites" })).toContainText("Accepted");
    const log = owner.page.getByRole("list", { name: "Audit log, newest first" });
    await expect(log).toContainText("Invite accepted");

    for (const scheme of ["light", "dark"] as const) {
      await owner.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await owner.page.reload();
      await owner.page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page: owner.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations, `${scheme}: ${axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`).join("; ")}`).toEqual([]);
    }

    // Remove the member (confirm dialog), then rename.
    owner.page.once("dialog", (d) => d.accept());
    await owner.page.getByRole("button", { name: /^Remove Fresh Student$/ }).click();
    await expect(owner.page.getByRole("list", { name: "Audit log, newest first" })).toContainText("Member removed");
    await owner.page.getByLabel("Name", { exact: true }).last().fill(`${name} renamed`);
    await owner.page.getByRole("button", { name: "Rename" }).click();
    await expect(owner.page.getByRole("heading", { name: `${name} renamed` })).toBeVisible();

    // The audit CSV downloads for the admin only.
    const orgId = (await owner.page.locator("section.org-card").first().getAttribute("aria-labelledby"))!.replace("org-", "");
    const csv = await owner.page.request.get(`/api/org/${orgId}/audit`);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toMatch(/"invite.accepted"/);
    expect(await (await invitee.page.request.get(`/api/org/${orgId}/audit`)).text()).not.toMatch(/invite/);

    // Delete needs the exact name.
    await owner.page.getByLabel(/Delete the organisation/).fill(`${name} renamed`);
    await owner.page.getByRole("button", { name: "Delete organisation" }).click();
    await expect(owner.page.getByText("You aren't in an organisation yet.")).toBeVisible();
  } finally {
    await invitee.cleanup();
    await owner.cleanup();
  }
});
