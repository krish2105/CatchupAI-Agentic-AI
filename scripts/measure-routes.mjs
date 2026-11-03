#!/usr/bin/env node
/**
 * Page load timings for every app screen, signed in as a fresh synthetic student (LOCAL stack only).
 * Start the production server first: npm run build && npx next start -p 3100
 *   node scripts/measure-routes.mjs [http://localhost:3100]
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const base = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url ?? "")) throw new Error("local stack only");
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const email = `perf-${Date.now().toString(36)}@test.catchup.local`;
const { data: created } = await db.auth.admin.createUser({ email, email_confirm: true });
await db.from("profiles").update({ display_name: "Perf", timezone: "UTC", onboarded_at: new Date().toISOString() }).eq("id", created.user.id);
const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${base}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/dashboard`);
await page.waitForURL(/dashboard/);
const routes = ["/dashboard", "/universe", "/assistant", "/catch-up", "/recovery", "/courses", "/planner", "/quizzes", "/insights", "/focus", "/settings", "/quality", "/"];
const rows = [];
for (const r of routes) {
  for (const pass of ["cold", "warm"]) {
    await page.goto(base + r, { waitUntil: "load" });
    const t = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
      const js = performance.getEntriesByType("resource").filter((e) => e.initiatorType === "script").reduce((s, e) => s + e.encodedBodySize, 0);
      return { ttfb: Math.round(n.responseStart), html: Math.round(n.responseEnd), fcp: Math.round(fcp?.startTime ?? 0), load: Math.round(n.loadEventEnd), jsKB: Math.round(js / 1024) };
    });
    if (pass === "warm") rows.push({ route: r, ...t });
  }
}
await browser.close();
await db.auth.admin.deleteUser(created.user.id);
console.table(rows);
