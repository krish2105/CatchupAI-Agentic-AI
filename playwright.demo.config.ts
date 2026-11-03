import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

/**
 * Records the captioned product demo (npm run demo:record). Same local production build and scripted test
 * model as the E2E suite, synthetic data only, never the live site.
 */
const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "demo",
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL, viewport: { width: 1280, height: 720 } },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    env: { CATCHUP_TEST_MODEL: "scripted" },
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
