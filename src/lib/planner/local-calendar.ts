/**
 * UAE local calendar: Friday prayer, prayer-time breaks, Ramadan and Hijri dates. Pure (no I/O, no clock reads),
 * shared by the server planner and the browser.
 *
 * Privacy: prayer times come from the city the student picks in Settings, using fixed city-centre coordinates
 * below. The app never asks the device for its location; only the city key and calculation method are stored.
 * Every religious setting is off until the student turns it on.
 */
import { TZDate } from "@date-fns/tz";
import { CalculationMethod, Coordinates, PrayerTimes } from "adhan";
import type { CalendarBreak, CalendarRules } from "./engine";

/** City centres (Wikipedia coordinates, checked 8 Nov 2026). One city per emirate, plus Al Ain. */
export const UAE_CITIES = {
  abu_dhabi: { label: "Abu Dhabi", latitude: 24.4667, longitude: 54.3667 },
  dubai: { label: "Dubai", latitude: 25.2047, longitude: 55.2708 },
  sharjah: { label: "Sharjah", latitude: 25.3575, longitude: 55.3908 },
  ajman: { label: "Ajman", latitude: 25.4136, longitude: 55.4456 },
  umm_al_quwain: { label: "Umm Al Quwain", latitude: 25.5533, longitude: 55.5475 },
  ras_al_khaimah: { label: "Ras Al Khaimah", latitude: 25.7667, longitude: 55.95 },
  fujairah: { label: "Fujairah", latitude: 25.1222, longitude: 56.3344 },
  al_ain: { label: "Al Ain", latitude: 24.2075, longitude: 55.7447 },
} as const;
export type UaeCity = keyof typeof UAE_CITIES;
export const UAE_CITY_KEYS = Object.keys(UAE_CITIES) as [UaeCity, ...UaeCity[]];

export const PRAYER_METHODS = { dubai: "UAE (Dubai)", umm_al_qura: "Umm al-Qura" } as const;
export type PrayerMethod = keyof typeof PRAYER_METHODS;
export const PRAYER_METHOD_KEYS = Object.keys(PRAYER_METHODS) as [PrayerMethod, ...PrayerMethod[]];

/** A 15-minute break around each prayer: from 5 minutes before the prayer time to 10 minutes after. */
export const PRAYER_BREAK = { beforeMinutes: 5, afterMinutes: 10 } as const;
/** Friday prayer window, local time, Fridays only. */
export const FRIDAY_PRAYER_WINDOW = { start: [12, 0], end: [14, 0] } as const;
/** In Ramadan, no study in the hour before Maghrib (iftar). */
export const PRE_IFTAR_MINUTES = 60;
export const RAMADAN_REDUCTION = { min: 0, max: 75, step: 5, default: 25 } as const;

export type LocalCalendarPrefs = {
  fridayPrayer: boolean;
  prayerBreaks: boolean;
  city: UaeCity | null;
  method: PrayerMethod | null;
  ramadanMode: boolean;
  ramadanReductionPercent: number;
  /** Optional manual Ramadan dates (YYYY-MM-DD, inclusive); otherwise the Umm al-Qura calendar decides. */
  ramadanStart: string | null;
  ramadanEnd: string | null;
  /** Optional study start time (HH:MM) on Ramadan days, for late-evening study. */
  ramadanStudyStart: string | null;
  showHijri: boolean;
};

export const DEFAULT_LOCAL_CALENDAR: LocalCalendarPrefs = {
  fridayPrayer: false,
  prayerBreaks: false,
  city: null,
  method: null,
  ramadanMode: false,
  ramadanReductionPercent: RAMADAN_REDUCTION.default,
  ramadanStart: null,
  ramadanEnd: null,
  ramadanStudyStart: null,
  showHijri: false,
};

const MINUTE = 60_000;
const pad2 = (n: number) => String(n).padStart(2, "0");
const ymdOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseYmd = (ymd: string) => ymd.split("-").map(Number) as [number, number, number];

/** The student's local calendar date (YYYY-MM-DD) of an instant. */
export function localYmd(ms: number, timezone: string): string {
  return ymdOf(new TZDate(ms, timezone));
}

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

/** The five prayer times (epoch ms) of one civil day in a UAE city. */
export function prayerTimes(ymd: string, city: UaeCity, method: PrayerMethod): Record<PrayerName, number> {
  const [y, m, d] = parseYmd(ymd);
  const { latitude, longitude } = UAE_CITIES[city];
  const params = method === "umm_al_qura" ? CalculationMethod.UmmAlQura() : CalculationMethod.Dubai();
  // adhan reads the calendar date from the Date's local fields, so build it from them (at noon) to get the same
  // answer whatever time zone the server or browser runs in.
  const times = new PrayerTimes(new Coordinates(latitude, longitude), new Date(y, m - 1, d, 12), params);
  return { fajr: times.fajr.getTime(), dhuhr: times.dhuhr.getTime(), asr: times.asr.getTime(), maghrib: times.maghrib.getTime(), isha: times.isha.getTime() };
}

const HIJRI_MONTH = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", timeZone: "UTC" });
const HIJRI_LONG = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const civilNoon = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

/** Is this civil date in Ramadan? The student's own dates win; otherwise the Umm al-Qura calendar (month 9). */
export function isRamadanDay(ymd: string, override?: { ramadanStart: string | null; ramadanEnd: string | null }): boolean {
  if (override?.ramadanStart && override.ramadanEnd) return ymd >= override.ramadanStart && ymd <= override.ramadanEnd;
  return HIJRI_MONTH.format(civilNoon(ymd)) === "9";
}

/** Umm al-Qura date for a civil date, e.g. "28 Jumada I 1448 AH". Changes at midnight, not at sunset. */
export function hijriLabel(ymd: string): string {
  const parts = Object.fromEntries(HIJRI_LONG.formatToParts(civilNoon(ymd)).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year} AH`;
}

/** True when a setting changes when the student can study (Hijri dates are display only). */
export function hasPlanningRules(prefs: LocalCalendarPrefs): boolean {
  const located = prefs.city !== null && prefs.method !== null;
  return prefs.fridayPrayer || (located && (prefs.prayerBreaks || prefs.ramadanMode));
}

/**
 * What the copilot is told about the rules in force, so it doesn't misstate the student's time. The planner has
 * already applied them; the city is left out because the copilot doesn't need it.
 */
export function localCalendarSummary(prefs: LocalCalendarPrefs, timezone: string, now: number) {
  if (!hasPlanningRules(prefs)) return null;
  const located = prefs.city !== null && prefs.method !== null;
  return {
    ...(prefs.fridayPrayer ? { fridayPrayerKeptFree: "Fridays 12:00-14:00 local time" } : {}),
    ...(located && prefs.prayerBreaks ? { prayerTimeBreaks: "15 minutes around each of the five daily prayers" } : {}),
    ...(located && prefs.ramadanMode
      ? {
          ramadan: {
            todayIsRamadan: isRamadanDay(localYmd(now, timezone), prefs),
            dailyMinutesReducedByPercent: prefs.ramadanReductionPercent,
            noStudyMinutesBeforeMaghrib: PRE_IFTAR_MINUTES,
            ...(prefs.ramadanStudyStart ? { studyStartTimeOnRamadanDays: prefs.ramadanStudyStart } : {}),
          },
        }
      : {}),
    note: "Study windows pause for these breaks and resume after them; drafted plans already respect them.",
  };
}

/**
 * Engine rules for every local day touching [from, to]: breaks as absolute instants and the Ramadan dates.
 * Returns undefined when nothing applies, so the planner behaves exactly as without this feature.
 */
export function buildCalendarRules(prefs: LocalCalendarPrefs, timezone: string, from: number, to: number): CalendarRules | undefined {
  if (!hasPlanningRules(prefs)) return undefined;
  const located = prefs.city !== null && prefs.method !== null ? { city: prefs.city, method: prefs.method } : null;
  const breaks: CalendarBreak[] = [];
  const ramadanDates: string[] = [];
  const first = new TZDate(from, timezone);
  for (let offset = -1; ; offset++) {
    const noon = new TZDate(first.getFullYear(), first.getMonth(), first.getDate() + offset, 12, 0, 0, timezone);
    const [y, m, d] = [noon.getFullYear(), noon.getMonth(), noon.getDate()];
    if (new TZDate(y, m, d, 0, 0, 0, timezone).getTime() > to + 86_400_000) break;
    const ymd = ymdOf(noon);

    if (prefs.fridayPrayer && noon.getDay() === 5) {
      const [sh, sm] = FRIDAY_PRAYER_WINDOW.start;
      const [eh, em] = FRIDAY_PRAYER_WINDOW.end;
      breaks.push({ start: new TZDate(y, m, d, sh, sm, 0, timezone).getTime(), end: new TZDate(y, m, d, eh, em, 0, timezone).getTime(), reason: "friday_prayer" });
    }
    if (!located) continue;
    const times = prefs.prayerBreaks || prefs.ramadanMode ? prayerTimes(ymd, located.city, located.method) : null;
    if (prefs.prayerBreaks && times) {
      for (const t of [times.fajr, times.dhuhr, times.asr, times.maghrib, times.isha]) {
        breaks.push({ start: t - PRAYER_BREAK.beforeMinutes * MINUTE, end: t + PRAYER_BREAK.afterMinutes * MINUTE, reason: "prayer" });
      }
    }
    if (prefs.ramadanMode && times && isRamadanDay(ymd, prefs)) {
      ramadanDates.push(ymd);
      breaks.push({ start: times.maghrib - PRE_IFTAR_MINUTES * MINUTE, end: times.maghrib, reason: "pre_iftar" });
    }
  }
  breaks.sort((a, b) => a.start - b.start);
  const rules: CalendarRules = { breaks };
  if (prefs.ramadanMode && located) {
    rules.ramadan = { dates: ramadanDates, reductionPercent: prefs.ramadanReductionPercent, studyStartTime: prefs.ramadanStudyStart };
  }
  return rules;
}
