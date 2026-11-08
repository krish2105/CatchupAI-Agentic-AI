/**
 * Hijri (Umm al-Qura) dates from the built-in Intl calendar: no library, safe in the browser. Dates change at
 * midnight, not at sunset, and official UAE dates follow moon sighting, so labels are approximate.
 */
const HIJRI_MONTH = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", timeZone: "UTC" });
const HIJRI_LONG = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const civilNoon = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
const parts = (ymd: string) => Object.fromEntries(HIJRI_LONG.formatToParts(civilNoon(ymd)).map((p) => [p.type, p.value]));

/** Umm al-Qura month number (1–12) of a civil date (YYYY-MM-DD). */
export function hijriMonth(ymd: string): number {
  return Number(HIJRI_MONTH.format(civilNoon(ymd)));
}

/** e.g. "28 Jumada I 1448 AH". */
export function hijriLabel(ymd: string): string {
  const p = parts(ymd);
  return `${p.day} ${p.month} ${p.year} AH`;
}

/** e.g. "28 Jumada I" (for narrow day headers). */
export function hijriDayMonth(ymd: string): string {
  const p = parts(ymd);
  return `${p.day} ${p.month}`;
}
