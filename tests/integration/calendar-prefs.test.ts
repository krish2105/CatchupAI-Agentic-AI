import { TZDate } from "@date-fns/tz";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCalendarPrefs, saveCalendarPrefs } from "@/lib/calendar-prefs/service";
import { DEFAULT_LOCAL_CALENDAR, type LocalCalendarPrefs } from "@/lib/planner/local-calendar";
import { approveProposal, computePlan, createProposal } from "@/lib/planner/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;

const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const key = () => crypto.randomUUID().replaceAll("-", "");
const prefs = (over: Partial<LocalCalendarPrefs> = {}): LocalCalendarPrefs => ({ ...DEFAULT_LOCAL_CALENDAR, ...over });
const pause = () => new Promise((r) => setTimeout(r, 20));

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (e) {
    return e as { status: number; code: string };
  }
}

/** Minutes of a block that fall inside Friday 12:00–14:00 in Dubai. */
function inFridayPrayer(task: { startsAt: string; endsAt: string }) {
  const start = new TZDate(Date.parse(task.startsAt), "Asia/Dubai");
  if (start.getDay() !== 5) return false;
  const noon = new TZDate(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, "Asia/Dubai").getTime();
  return Date.parse(task.startsAt) < noon + 2 * 3600_000 && Date.parse(task.endsAt) > noon;
}

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("cal-a"), signedInUser("cal-b")]);
  // Both students: Dubai, Fridays only, 4 hours from 11:00; the same 3-hour worksheet due in 8 days (always one Friday).
  for (const user of [a, b]) {
    await user.db.from("profiles").update({ timezone: "Asia/Dubai", weekly_minutes: [0, 0, 0, 0, 240, 0, 0], study_start_time: "11:00" }).eq("id", user.id);
    const course = await user.db.from("courses").insert({ title: "Statistics" }).select("id").single();
    await user.db.from("assignments").insert({ course_id: course.data!.id, title: "Worksheet", due_at: new Date(Date.now() + 8 * 86400_000).toISOString(), estimated_minutes: 180 });
  }
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("local calendar preferences", () => {
  it("are off by default (weeks still start on Monday) and saved per student", async () => {
    expect(await getCalendarPrefs(asServer(a.db))).toEqual(DEFAULT_LOCAL_CALENDAR);
    const mine = prefs({ fridayPrayer: true, city: "dubai", method: "dubai", showHijri: true });
    expect(await saveCalendarPrefs(asServer(a.db), mine)).toEqual(mine);
    expect(await getCalendarPrefs(asServer(a.db))).toEqual(mine);
    expect(await getCalendarPrefs(asServer(b.db))).toEqual(DEFAULT_LOCAL_CALENDAR);
  });

  it("are private: no reading, forging or changing another student's row", async () => {
    await saveCalendarPrefs(asServer(b.db), prefs());
    const peek = await b.db.from("calendar_prefs").select("owner_id").eq("owner_id", a.id);
    expect(peek.data).toEqual([]);
    const forged = await b.db.from("calendar_prefs").insert({ owner_id: a.id, friday_prayer: false } as never);
    expect(forged.error?.code).toBe("42501");
    const touched = await a.db.from("calendar_prefs").update({ show_hijri: true }).eq("owner_id", b.id).select("owner_id");
    expect(touched.data).toEqual([]);
    expect((await getCalendarPrefs(asServer(b.db))).showHijri).toBe(false);
    const sneaky = await a.db.from("calendar_prefs").update({ rules_changed_at: "2000-01-01T00:00:00Z" } as never).eq("owner_id", a.id);
    expect(sneaky.error?.code).toBe("42501");
  });

  it("are checked by the database too", async () => {
    const bad: Record<string, unknown>[] = [
      { prayer_city: "paris" },
      { prayer_method: "made_up" },
      { ramadan_reduction_pct: 80 },
      { ramadan_reduction_pct: 12 },
      { ramadan_start: "2027-03-01", ramadan_end: "2027-02-01" },
      { ramadan_start: "2027-02-01", ramadan_end: null },
      { ramadan_start: "2027-02-08", ramadan_end: "2027-03-10" }, // 31 days; a Hijri month has at most 30
      { prayer_breaks: true, prayer_city: null },
    ];
    for (const patch of bad) {
      const res = await a.db.from("calendar_prefs").update(patch as never).eq("owner_id", a.id);
      expect(res.error?.code, JSON.stringify(patch)).toBe("23514");
    }
  });
});

describe("planning with local calendar rules", () => {
  it("keeps Friday prayer free for the student who asked, and only for them", async () => {
    const now = Date.now();
    const [planA, planB] = await Promise.all([computePlan(asServer(a.db), a.id, { now }), computePlan(asServer(b.db), b.id, { now })]);
    const tasksA = planA.scenarios[0].tasks;
    const tasksB = planB.scenarios[0].tasks;
    expect(tasksA.reduce((s, t) => s + t.minutes, 0)).toBe(180);
    expect(tasksA.some(inFridayPrayer)).toBe(false);
    expect(tasksB.some(inFridayPrayer)).toBe(true);
  });

  it("refuses a draft made before a planning rule changed, but not after a display-only change", async () => {
    const before = await createProposal({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, scenario: "essential", now: Date.now() });
    await pause();
    await saveCalendarPrefs(asServer(a.db), prefs({ fridayPrayer: true, city: "dubai", method: "dubai", showHijri: false }));
    const ok = await approveProposal(asServer(a.db), before.id, key());
    expect(ok).toMatchObject({ planId: expect.any(String) });

    const draft = await createProposal({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, scenario: "essential", now: Date.now() });
    await pause();
    await saveCalendarPrefs(asServer(a.db), prefs({ fridayPrayer: false, city: "dubai", method: "dubai" }));
    expect(await errorOf(approveProposal(asServer(a.db), draft.id, key()))).toMatchObject({ status: 409, code: "stale" });
  });

  it("doesn't refuse a draft when only settings without effect change (city or Ramadan details with no rule on)", async () => {
    const draft = await createProposal({ supabase: asServer(b.db), admin: adminDb(), userId: b.id, scenario: "essential", now: Date.now() });
    await pause();
    await saveCalendarPrefs(asServer(b.db), prefs({ showHijri: true, city: "sharjah", method: "umm_al_qura", ramadanReductionPercent: 40, ramadanStudyStart: "21:00" }));
    expect(await approveProposal(asServer(b.db), draft.id, key())).toMatchObject({ planId: expect.any(String) });
  });
});
