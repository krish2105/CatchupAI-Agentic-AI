/**
 * Loads the fictional "Alex Morgan" scenario (data/demo_scenario.json) into a REAL local account so the
 * app can be demonstrated end-to-end. All content is synthetic. Due dates are shifted relative to today
 * so the demo stays meaningful on any date. Refuses to run against non-local Supabase unless --allow-remote.
 *
 *   npm run seed:demo -- --email you@example.com [--reset]
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TZDate } from "@date-fns/tz";
import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

type Scenario = {
  student: { displayName: string; timezone: string; dailyStudyMinutes: number };
  courses: { title: string; description: string; assignments?: { title: string; dueAt: string; estimatedMinutes: number; status: string }[] }[];
};

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  if (!email) throw new Error("Usage: npm run seed:demo -- --email you@example.com [--reset]");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  if (!/127\.0\.0\.1|localhost/.test(url) && !process.argv.includes("--allow-remote")) {
    throw new Error("Refusing to seed a non-local Supabase project without --allow-remote");
  }
  const db = createClient<Database>(url, secret, { auth: { persistSession: false } });
  const scenario = JSON.parse(readFileSync("data/demo_scenario.json", "utf8")) as Scenario;

  // Find or create the account (no password; sign in with the emailed code).
  let userId: string | undefined;
  for (let page = 1; !userId && page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  }

  if (process.argv.includes("--reset")) {
    await db.from("study_plans").delete().eq("owner_id", userId);
    await db.from("action_proposals").delete().eq("owner_id", userId);
    await db.from("courses").delete().eq("owner_id", userId);
  }

  const tz = scenario.student.timezone;
  const daily = scenario.student.dailyStudyMinutes;
  await db.from("profiles").update({
    display_name: scenario.student.displayName,
    timezone: tz,
    weekly_minutes: [daily, daily, daily, daily, daily, 60, 60],
    study_start_time: "17:00",
    onboarded_at: new Date().toISOString(),
  }).eq("id", userId);

  // Shift the scenario so its earliest deadline lands 3 days from today, keeping local wall-clock times.
  const all = scenario.courses.flatMap((c) => c.assignments ?? []);
  const earliest = Math.min(...all.map((a) => Date.parse(a.dueAt)));
  const today = new TZDate(Date.now(), tz);
  const shiftDays = Math.round((new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + 3, 0, 0, 0, tz).getTime() - earliest) / 86400_000) + 1;

  for (const course of scenario.courses) {
    const { data: created, error } = await db.from("courses").insert({ owner_id: userId, title: course.title, description: course.description }).select("id").single();
    if (error) throw error;
    for (const a of course.assignments ?? []) {
      const original = new TZDate(Date.parse(a.dueAt), tz);
      const shifted = new TZDate(original.getFullYear(), original.getMonth(), original.getDate() + shiftDays, original.getHours(), original.getMinutes(), 0, tz);
      const { error: aErr } = await db.from("assignments").insert({
        owner_id: userId,
        course_id: created.id,
        title: a.title,
        due_at: new Date(shifted.getTime()).toISOString(),
        estimated_minutes: a.estimatedMinutes,
        status: a.status,
        required: true,
      });
      if (aErr) throw aErr;
    }
  }
  console.log(`Seeded synthetic demo data for ${email} (${scenario.courses.length} courses). Sign in at /login with an emailed code.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
