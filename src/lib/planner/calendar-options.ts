/**
 * Choices and defaults for the Local calendar settings. No dependencies, so the browser can import it without
 * pulling in the prayer-time library (that only runs in the planner, see local-calendar.ts).
 */

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
