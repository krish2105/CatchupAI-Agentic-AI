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
    env: { CATCHUP_TEST_MODEL: "scripted", OPS_OWNER_EMAILS: "ops-owner@test.catchup.local" },
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
