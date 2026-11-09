import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { latestCode } from "./mail";

const AUTH_FILE = "playwright/.auth/user.json";

setup("sign up with an emailed code and complete onboarding", async ({ page }) => {
  const email = `e2e-${Date.now().toString(36)}@test.catchup.local`;
  const started = Date.now() - 1000;
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /send sign-in code/i }).click();
  await page.getByLabel("6-digit code").fill(await latestCode(email, started));
  await page.getByRole("button", { name: /verify and sign in/i }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("E2E Student");
  await page.getByLabel("Time zone").selectOption("Asia/Dubai");
  await page.getByLabel("I'm 13 or older").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("E2E Student")).toBeVisible();

  mkdirSync("playwright/.auth", { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
  writeFileSync("playwright/.auth/user-meta.json", JSON.stringify({ email }));
});
