/**
 * UAE local calendar for the planner: Friday prayer, prayer-time breaks and Ramadan. Pure (no I/O, no clock reads).
 * Browser code imports calendar-options.ts and hijri.ts instead, which don't load the prayer-time library.
 *
 * Privacy: prayer times come from the city the student picks in Settings, using the fixed city-centre coordinates
 * in calendar-options.ts. The app never asks the device for its location; only the city key and calculation
 * method are stored. Every religious setting is off until the student turns it on.
 */
import { TZDate } from "@date-fns/tz";
import { CalculationMethod, Coordinates, PrayerTimes } from "adhan";
import {
  FRIDAY_PRAYER_WINDOW,
  PRAYER_BREAK,
  PRE_IFTAR_MINUTES,
  UAE_CITIES,
  type LocalCalendarPrefs,
  type PrayerMethod,
  type UaeCity,
} from "./calendar-options";
import type { CalendarBreak, CalendarRules } from "./engine";
import { hijriMonth } from "./hijri";

export * from "./calendar-options";
export { hijriDayMonth, hijriLabel } from "./hijri";

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

/** Is this civil date in Ramadan? The student's own dates win; otherwise the Umm al-Qura calendar (month 9). */
export function isRamadanDay(ymd: string, override?: { ramadanStart: string | null; ramadanEnd: string | null }): boolean {
  if (override?.ramadanStart && override.ramadanEnd) return ymd >= override.ramadanStart && ymd <= override.ramadanEnd;
  return hijriMonth(ymd) === 9;
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
