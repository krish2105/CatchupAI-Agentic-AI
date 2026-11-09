import { describe, expect, it } from "vitest";
import { calendarPrefsSchema } from "@/lib/calendar-prefs/schema";
import { DEFAULT_LOCAL_CALENDAR } from "@/lib/planner/local-calendar";

const valid = { ...DEFAULT_LOCAL_CALENDAR };
const parse = (over: Record<string, unknown>) => calendarPrefsSchema.safeParse({ ...valid, ...over });

describe("calendarPrefsSchema", () => {
  it("accepts the defaults and a full Ramadan setup", () => {
    expect(parse({}).success).toBe(true);
    expect(
      parse({ prayerBreaks: true, ramadanMode: true, city: "al_ain", method: "umm_al_qura", ramadanReductionPercent: 40, ramadanStart: "2027-02-08", ramadanEnd: "2027-03-09", ramadanStudyStart: "21:30" }).success,
    ).toBe(true);
  });

  it("rejects cities, methods and percentages outside the lists", () => {
    expect(parse({ city: "paris", method: "dubai" }).success).toBe(false);
    expect(parse({ city: "dubai", method: "isna" }).success).toBe(false);
    expect(parse({ ramadanReductionPercent: 80 }).success).toBe(false);
    expect(parse({ ramadanReductionPercent: 12 }).success).toBe(false);
    expect(parse({ ramadanReductionPercent: -5 }).success).toBe(false);
  });

  it("needs a city and method for prayer breaks and Ramadan mode, but not for the Friday window", () => {
    expect(parse({ prayerBreaks: true }).success).toBe(false);
    expect(parse({ ramadanMode: true, city: "dubai" }).success).toBe(false);
    expect(parse({ fridayPrayer: true }).success).toBe(true);
  });

  it("checks the manual Ramadan dates and start time", () => {
    expect(parse({ ramadanStart: "2027-02-08", ramadanEnd: null }).success).toBe(false);
    expect(parse({ ramadanStart: "2027-03-01", ramadanEnd: "2027-02-01" }).success).toBe(false);
    expect(parse({ ramadanStart: "2027-01-01", ramadanEnd: "2027-02-15" }).success).toBe(false);
    // A Hijri month has at most 30 days: 8 Feb to 9 Mar (30 days) is fine, one day more is not.
    expect(parse({ ramadanStart: "2027-02-08", ramadanEnd: "2027-03-09" }).success).toBe(true);
    expect(parse({ ramadanStart: "2027-02-08", ramadanEnd: "2027-03-10" }).success).toBe(false);
    expect(parse({ ramadanStart: "2027-02-30", ramadanEnd: "2027-03-01" }).success).toBe(false);
    expect(parse({ ramadanStudyStart: "25:00" }).success).toBe(false);
  });

  it("refuses unknown fields", () => {
    expect(parse({ latitude: 25.2 }).success).toBe(false);
  });
});
