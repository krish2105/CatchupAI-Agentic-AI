#!/usr/bin/env node
/**
 * Screenshots of the PUBLIC production pages (no sign-in, no bot check) at desktop and phone sizes in light
 * and dark mode, plus a horizontal-overflow check. Signed-in screens are verified on the local production build
 * by the E2E suite, because the live sign-in is protected by a human bot check.
 *   node scripts/capture-production-evidence.mjs https://catchupai-chi.vercel.app
 */
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "https://catchupai-chi.vercel.app").replace(/\/$/, "");
const browser = await chromium.launch();
const results = [];
for (const scheme of ["light", "dark"]) {
  for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const path of ["/", "/login", "/quality"]) {
      const res = await page.goto(base + path, { waitUntil: "load" });
      await page.waitForTimeout(1500); // the bot-check widget keeps the network busy, so no "networkidle"
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? "");
      const file = `docs/evidence/production/${(path === "/" ? "home" : path.slice(1))}-${name}-${scheme}.png`;
      await page.screenshot({ path: file });
      results.push({ path, viewport: name, scheme, status: res?.status(), theme, overflowPx: overflow, errors: errors.length });
    }
    await context.close();
  }
}
await browser.close();
console.table(results);
if (results.some((r) => r.status !== 200 || r.overflowPx > 0 || r.errors)) process.exit(1);
