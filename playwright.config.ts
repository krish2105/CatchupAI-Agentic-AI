import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// E2E runs against a PRODUCTION build on :3100 (separate from `npm run dev` on :3000). The scripted
// test model is enabled only for this local server; see src/lib/agents/runtime.ts.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    // OPS_OWNER_EMAILS makes one fixed test account the operator for the /ops tests.
    // Fake Stripe test-mode settings (not real keys): billing UI shows as enabled and the webhook verifies
    // events the tests sign with this secret. Nothing here can reach a real Stripe account.
    env: {
      CATCHUP_TEST_MODEL: "scripted",
      OPS_OWNER_EMAILS: "ops-owner@test.catchup.local",
      STRIPE_SECRET_KEY: "sk_test_e2e_not_a_real_key",
      STRIPE_WEBHOOK_SECRET: "whsec_e2e_not_a_real_secret",
      STRIPE_PRICE_CLASS: "price_e2e_not_real",
      STRIPE_CLASS_SEATS: "300",
    },
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
