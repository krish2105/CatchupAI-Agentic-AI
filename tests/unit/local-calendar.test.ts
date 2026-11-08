import { TZDate } from "@date-fns/tz";
import { afterEach, describe, expect, it } from "vitest";
import { planScenarios, type Availability, type WorkItem } from "@/lib/planner/engine";
import {
  buildCalendarRules,
  DEFAULT_LOCAL_CALENDAR,
  hijriLabel,
  isRamadanDay,
  localCalendarSummary,
  localYmd,
  PRAYER_BREAK,
  PRE_IFTAR_MINUTES,
  prayerTimes,
  UAE_CITIES,
  type LocalCalendarPrefs,
} from "@/lib/planner/local-calendar";

const MIN = 60_000;
const DAY = 86_400_000;
const prefs = (over: Partial<LocalCalendarPrefs> = {}): LocalCalendarPrefs => ({ ...DEFAULT_LOCAL_CALENDAR, ...over });
const clock = (ms: number, timezone = "Asia/Dubai") =>
  new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
const iso = (ms: number) => new Date(ms).toISOString();
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

describe("prayer times", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("gives the five prayers in order, on the city's own day, with either method", () => {
    for (const method of ["dubai", "umm_al_qura"] as const) {
      const t = prayerTimes("2026-11-13", "dubai", method);
      const order = PRAYERS.map((p) => t[p]);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      for (const ms of order) expect(localYmd(ms, "Asia/Dubai")).toBe("2026-11-13");
      expect(clock(t.fajr)).toMatch(/^0[45]:/);
      expect(clock(t.dhuhr)).toMatch(/^1[12]:/);
      expect(clock(t.maghrib)).toMatch(/^1[78]:/);
    }
  });

  it("does not depend on the computer's own time zone", () => {
    process.env.TZ = "UTC";
    const utc = prayerTimes("2026-11-13", "abu_dhabi", "dubai");
    process.env.TZ = "America/Los_Angeles";
    const la = prayerTimes("2026-11-13", "abu_dhabi", "dubai");
    process.env.TZ = "Pacific/Kiritimati";
    const kiri = prayerTimes("2026-11-13", "abu_dhabi", "dubai");
    expect(la).toEqual(utc);
    expect(kiri).toEqual(utc);
  });

  it("covers one city in each of the seven emirates plus Al Ain", () => {
    expect(Object.keys(UAE_CITIES).sort()).toEqual(["abu_dhabi", "ajman", "al_ain", "dubai", "fujairah", "ras_al_khaimah", "sharjah", "umm_al_quwain"]);
  });
});

describe("Ramadan and Hijri dates", () => {
  it("finds Ramadan 1448 in the Umm al-Qura calendar", () => {
    expect(isRamadanDay("2027-02-07")).toBe(false);
    expect(isRamadanDay("2027-02-08")).toBe(true);
    expect(isRamadanDay("2027-03-08")).toBe(true);
    expect(isRamadanDay("2027-03-09")).toBe(false);
  });

  it("uses the student's own start and end dates when given", () => {
    const override = { ramadanStart: "2027-02-09", ramadanEnd: "2027-03-10" };
    expect(isRamadanDay("2027-02-08", override)).toBe(false);
    expect(isRamadanDay("2027-02-09", override)).toBe(true);
    expect(isRamadanDay("2027-03-10", override)).toBe(true);
    expect(isRamadanDay("2027-03-11", override)).toBe(false);
  });

  it("labels a day with its Umm al-Qura date", () => {
    expect(hijriLabel("2026-11-08")).toBe("28 Jumada I 1448 AH");
  });
});

describe("buildCalendarRules", () => {
  const FROM = Date.parse("2026-11-09T00:00:00Z");
  const TO = FROM + 7 * DAY;

  it("adds nothing unless a planning rule is on (showing Hijri dates is display only)", () => {
    expect(buildCalendarRules(prefs(), "Asia/Dubai", FROM, TO)).toBeUndefined();
    expect(buildCalendarRules(prefs({ showHijri: true, city: "dubai", method: "dubai" }), "Asia/Dubai", FROM, TO)).toBeUndefined();
  });

  it("keeps Friday 12:00 to 14:00 local free, and only on Fridays", () => {
    const rules = buildCalendarRules(prefs({ fridayPrayer: true }), "Asia/Dubai", FROM, TO)!;
    const friday = rules.breaks.filter((b) => b.reason === "friday_prayer");
    expect(friday.map((b) => [iso(b.start), iso(b.end)])).toContainEqual(["2026-11-13T08:00:00.000Z", "2026-11-13T10:00:00.000Z"]);
    for (const b of friday) {
      expect(new TZDate(b.start, "Asia/Dubai").getDay()).toBe(5);
      expect([clock(b.start), clock(b.end)]).toEqual(["12:00", "14:00"]);
    }
  });

  it("keeps the Friday window at local noon on both sides of a DST change", () => {
    const london = buildCalendarRules(prefs({ fridayPrayer: true }), "Europe/London", Date.parse("2026-10-19T00:00:00Z"), Date.parse("2026-11-02T00:00:00Z"))!;
    expect(london.breaks.map((b) => iso(b.start))).toEqual(expect.arrayContaining(["2026-10-23T11:00:00.000Z", "2026-10-30T12:00:00.000Z"]));
    const ny = buildCalendarRules(prefs({ fridayPrayer: true }), "America/New_York", Date.parse("2026-10-26T00:00:00Z"), Date.parse("2026-11-09T00:00:00Z"))!;
    expect(ny.breaks.map((b) => iso(b.start))).toEqual(expect.arrayContaining(["2026-10-30T16:00:00.000Z", "2026-11-06T17:00:00.000Z"]));
    for (const b of ny.breaks) expect(clock(b.start, "America/New_York")).toBe("12:00");
  });

  it("adds a 15-minute break around each of the five prayers", () => {
    const rules = buildCalendarRules(prefs({ prayerBreaks: true, city: "dubai", method: "dubai" }), "Asia/Dubai", FROM, TO)!;
    const t = prayerTimes("2026-11-11", "dubai", "dubai");
    for (const p of PRAYERS) {
      expect(rules.breaks).toContainEqual({ start: t[p] - PRAYER_BREAK.beforeMinutes * MIN, end: t[p] + PRAYER_BREAK.afterMinutes * MIN, reason: "prayer" });
    }
    expect(rules.breaks.every((b) => b.end - b.start === 15 * MIN)).toBe(true);
  });

  it("adds no prayer breaks without a chosen city", () => {
    expect(buildCalendarRules(prefs({ prayerBreaks: true }), "Asia/Dubai", FROM, TO)).toBeUndefined();
  });

  it("lists Ramadan days and keeps the hour before Maghrib free on them only", () => {
    const from = Date.parse("2027-02-05T00:00:00Z");
    const rules = buildCalendarRules(prefs({ ramadanMode: true, ramadanReductionPercent: 30, city: "dubai", method: "dubai" }), "Asia/Dubai", from, from + 7 * DAY)!;
    expect(rules.ramadan?.dates).toEqual(expect.arrayContaining(["2027-02-08", "2027-02-09", "2027-02-12"]));
    expect(rules.ramadan?.dates).not.toContain("2027-02-07");
    expect(rules.ramadan?.reductionPercent).toBe(30);
    const iftar = rules.breaks.filter((b) => b.reason === "pre_iftar");
    expect(iftar.length).toBeGreaterThan(0);
    for (const b of iftar) {
      const day = localYmd(b.end, "Asia/Dubai");
      expect(rules.ramadan?.dates).toContain(day);
      expect(b.end).toBe(prayerTimes(day, "dubai", "dubai").maghrib);
      expect(b.end - b.start).toBe(PRE_IFTAR_MINUTES * MIN);
    }
  });

  it("follows the student's own Ramadan dates and evening start time", () => {
    const rules = buildCalendarRules(
      prefs({ ramadanMode: true, city: "sharjah", method: "umm_al_qura", ramadanStart: "2026-11-10", ramadanEnd: "2026-11-11", ramadanStudyStart: "21:00" }),
      "Asia/Dubai",
      FROM,
      TO,
    )!;
    expect(rules.ramadan).toEqual({ dates: ["2026-11-10", "2026-11-11"], reductionPercent: 25, studyStartTime: "21:00" });
  });
});

describe("localCalendarSummary (what the copilot is told)", () => {
  it("is empty when no planning rule is on", () => {
    expect(localCalendarSummary(prefs({ showHijri: true }), "Asia/Dubai", Date.parse("2026-11-09T08:00:00Z"))).toBeNull();
  });

  it("describes the rules in force, says whether today is a Ramadan day, and never names the city", () => {
    const summary = localCalendarSummary(
      prefs({ fridayPrayer: true, prayerBreaks: true, ramadanMode: true, ramadanReductionPercent: 30, city: "fujairah", method: "dubai" }),
      "Asia/Dubai",
      Date.parse("2027-02-10T08:00:00Z"),
    );
    expect(summary).toMatchObject({
      fridayPrayerKeptFree: "Fridays 12:00-14:00 local time",
      prayerTimeBreaks: expect.stringContaining("15 minutes"),
      ramadan: { todayIsRamadan: true, dailyMinutesReducedByPercent: 30, noStudyMinutesBeforeMaghrib: 60 },
    });
    expect(JSON.stringify(summary).toLowerCase()).not.toContain("fujairah");
  });
});

describe("planner with local calendar rules", () => {
  const item = (id: string, minutes: number, deadline: string): WorkItem => ({ id, kind: "assignment", title: id, courseId: "c1", assignmentId: id, minutes, deadline, tier: "required" });

  it("schedules nothing in the Friday prayer window, in London on both sides of DST, without losing minutes", () => {
    // Fridays only, 11:00 local start, 180 minutes.
    const availability: Availability = { timezone: "Europe/London", weeklyMinutes: [0, 0, 0, 0, 180, 0, 0], studyStartTime: "11:00" };
    const now = Date.parse("2026-10-19T08:00:00Z");
    const calendar = buildCalendarRules(prefs({ fridayPrayer: true }), "Europe/London", now - DAY, now + 23 * DAY);
    const plan = planScenarios({ items: [item("essay", 300, "2026-11-01T00:00:00Z")], availability: { ...availability, calendar }, now });
    // Two Fridays (23 Oct BST, 30 Oct GMT) × 180 minutes: the break moves time, it doesn't remove it.
    expect(plan.availableMinutes).toBe(360);
    const tasks = plan.scenarios[0].tasks;
    expect(tasks.reduce((s, t) => s + t.minutes, 0)).toBe(300);
    for (const t of tasks) {
      const start = clock(Date.parse(t.startsAt), "Europe/London");
      const end = clock(Date.parse(t.endsAt), "Europe/London");
      expect(end <= "12:00" || start >= "14:00").toBe(true);
    }
  });
});
