import { z } from "zod";

export const uuid = z.uuid();

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timeZone = z.string().min(1).max(64).refine(isValidTimeZone, "Unknown time zone");
/** ISO-8601 instant with explicit offset (or Z). */
export const isoInstant = z.iso.datetime({ offset: true });
