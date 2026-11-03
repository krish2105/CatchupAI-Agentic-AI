import { TZDate } from "@date-fns/tz";

/** "2026-11-13T16:00" (wall clock in `tz`) -> ISO instant with Z. DST-safe via TZDate. */
export function localInputToIso(value: string, tz: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new RangeError("Expected YYYY-MM-DDTHH:MM");
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, tz).getTime()).toISOString();
}

/** ISO instant -> "YYYY-MM-DDTHH:MM" wall clock in `tz` (for <input type="datetime-local">). */
export function isoToLocalInput(iso: string, tz: string): string {
  const d = new TZDate(new Date(iso).getTime(), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(iso: string, tz: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...opts }).format(new Date(iso));
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Relative due label, e.g. "in 3 days", "overdue by 2h". */
export function dueLabel(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const span = hours < 36 ? `${hours}h` : `${days} days`;
  return diff >= 0 ? `due in ${span}` : `overdue by ${span}`;
}
