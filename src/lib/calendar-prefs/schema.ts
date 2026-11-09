import { z } from "zod";
import { PRAYER_METHOD_KEYS, RAMADAN_REDUCTION, UAE_CITY_KEYS } from "@/lib/planner/calendar-options";

const DAY = 86_400_000;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "Not a real date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

/** The whole Local calendar card, saved at once (same rules as the database's check constraints). */
export const calendarPrefsSchema = z
  .object({
    fridayPrayer: z.boolean(),
    prayerBreaks: z.boolean(),
    city: z.enum(UAE_CITY_KEYS).nullable(),
    method: z.enum(PRAYER_METHOD_KEYS).nullable(),
    ramadanMode: z.boolean(),
    ramadanReductionPercent: z.number().int().min(RAMADAN_REDUCTION.min).max(RAMADAN_REDUCTION.max).multipleOf(RAMADAN_REDUCTION.step),
    ramadanStart: date.nullable(),
    ramadanEnd: date.nullable(),
    ramadanStudyStart: time.nullable(),
    showHijri: z.boolean(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if ((p.prayerBreaks || p.ramadanMode) && (p.city === null || p.method === null)) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Choose your city and calculation method first." });
    }
    if ((p.ramadanStart === null) !== (p.ramadanEnd === null)) {
      ctx.addIssue({ code: "custom", path: ["ramadanEnd"], message: "Give both a start and an end date, or leave both empty." });
    } else if (p.ramadanStart && p.ramadanEnd) {
      const span = (Date.parse(`${p.ramadanEnd}T00:00:00Z`) - Date.parse(`${p.ramadanStart}T00:00:00Z`)) / DAY;
      // A Hijri month has at most 30 days, so the last day is at most 29 days after the first.
      if (span < 0 || span > 29) ctx.addIssue({ code: "custom", path: ["ramadanEnd"], message: "The last day must be on or after the first, and Ramadan lasts at most 30 days." });
    }
  });
