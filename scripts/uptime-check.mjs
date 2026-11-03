#!/usr/bin/env node
/**
 * Uptime and readiness check for a CatchUp AI deployment: liveness, database readiness, the public pages
 * and the security headers. Exits 1 on any failure (used by .github/workflows/uptime.yml).
 *   node scripts/uptime-check.mjs https://catchupai-chi.vercel.app
 */
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const failures = [];

async function check(name, path, test) {
  const started = Date.now();
  try {
    const res = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const problem = await test(res);
    const ms = Date.now() - started;
    if (problem) failures.push(`${name}: ${problem}`);
    console.log(`${problem ? "FAIL" : "ok  "} ${name} (${res.status}, ${ms} ms)${problem ? ` - ${problem}` : ""}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    console.log(`FAIL ${name} - ${e.message}`);
  }
}

await check("liveness", "/api/health", async (r) => (r.ok ? null : `status ${r.status}`));
await check("readiness", "/api/health/ready", async (r) => {
  const body = await r.json().catch(() => ({}));
  return r.ok && body.checks?.database === "ok" ? null : `database ${body.checks?.database ?? "unknown"}`;
});
await check("landing page", "/", async (r) => (r.ok && r.headers.get("content-security-policy")?.includes("nonce-") ? null : "missing page or CSP"));
await check("quality page", "/quality", async (r) => (r.ok ? null : `status ${r.status}`));
await check("protected route redirects", "/dashboard", async (r) => (r.status === 307 || r.status === 308 ? null : `expected redirect, got ${r.status}`));
await check("cron is protected", "/api/cron/nudges", async (r) => (r.status === 403 ? null : `expected 403, got ${r.status}`));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
