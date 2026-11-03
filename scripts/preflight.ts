/**
 * Release preflight: checks that an environment is complete and reachable BEFORE deploying.
 *   npm run preflight                 (reads .env.local)
 *   npm run preflight -- --production (requires non-local URLs and every production setting)
 * Prints only names and pass/fail — never secret values.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const production = process.argv.includes("--production");
const env = process.env;
type Check = { name: string; ok: boolean; note: string; required: boolean };
const checks: Check[] = [];
const add = (name: string, ok: boolean, note: string, required = true) => checks.push({ name, ok, note, required });

const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const local = /127\.0\.0\.1|localhost/.test(url);
add("NEXT_PUBLIC_SUPABASE_URL", Boolean(url) && (!production || !local), production && local ? "points at a local stack" : url ? "set" : "missing");
add("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", /^(sb_publishable_|eyJ)/.test(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""), "publishable key format");
add("SUPABASE_SECRET_KEY", /^(sb_secret_|eyJ)/.test(env.SUPABASE_SECRET_KEY ?? ""), "server secret key format");
add("OPENAI_API_KEY", Boolean(env.OPENAI_API_KEY), env.OPENAI_API_KEY ? "set" : "missing — copilot disabled, retrieval lexical-only", production);
add("OPENAI_MODEL", Boolean(env.OPENAI_MODEL?.trim()), env.OPENAI_MODEL ? "set" : "missing — copilot disabled", production);
add("NEXT_PUBLIC_APP_URL", Boolean(env.NEXT_PUBLIC_APP_URL) && (!production || !/localhost/.test(env.NEXT_PUBLIC_APP_URL ?? "")), env.NEXT_PUBLIC_APP_URL ?? "missing", production);
add("NEXT_PUBLIC_TURNSTILE_SITE_KEY", Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "set" : "missing — demo sign-ins rely on Supabase IP rate limits only", production);
add("CRON_SECRET", (env.CRON_SECRET ?? "").length >= 24, (env.CRON_SECRET ?? "").length >= 24 ? "set" : "missing or shorter than 24 chars — demo cleanup disabled", production);
add("CATCHUP_TEST_MODEL", !(production && env.CATCHUP_TEST_MODEL), env.CATCHUP_TEST_MODEL ? "set (must be unset in production)" : "unset");

async function main() {
  if (url) {
    try {
      const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } });
      add("Supabase Auth reachable", res.ok, `HTTP ${res.status}`);
      const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } }).then((r) => r.json()).catch(() => ({}));
      add("Auth: email sign-in enabled", settings?.external?.email === true, "email provider");
      add("Auth: anonymous sign-ins enabled (one-click demo)", settings?.external?.anonymous_users === true, "anonymous provider", false);
    } catch {
      add("Supabase Auth reachable", false, "network error");
    }
  }
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : c.required ? "FAIL" : "WARN";
    if (!c.ok && c.required) failed++;
    console.log(`${mark.padEnd(5)} ${c.name} — ${c.note}`);
  }
  console.log(failed ? `\n${failed} required check(s) failed.` : "\nAll required checks passed.");
  process.exit(failed ? 1 : 0);
}

void main();
