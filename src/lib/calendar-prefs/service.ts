import "server-only";
import { ApiError, fromDbError, isMissingSchema } from "@/lib/http/errors";
import { DEFAULT_LOCAL_CALENDAR, type LocalCalendarPrefs, type PrayerMethod, type UaeCity } from "@/lib/planner/calendar-options";
import type { ServerSupabase } from "@/lib/supabase/server";

export { calendarPrefsSchema } from "./schema";

const COLUMNS = "friday_prayer, prayer_breaks, prayer_city, prayer_method, ramadan_mode, ramadan_reduction_pct, ramadan_start, ramadan_end, ramadan_study_start, show_hijri, rules_changed_at";

type Row = {
  friday_prayer: boolean;
  prayer_breaks: boolean;
  prayer_city: string | null;
  prayer_method: string | null;
  ramadan_mode: boolean;
  ramadan_reduction_pct: number;
  ramadan_start: string | null;
  ramadan_end: string | null;
  ramadan_study_start: string | null;
  show_hijri: boolean;
  rules_changed_at: string | null;
};

function toPrefs(row: Row): LocalCalendarPrefs {
  return {
    fridayPrayer: row.friday_prayer,
    prayerBreaks: row.prayer_breaks,
    city: row.prayer_city as UaeCity | null,
    method: row.prayer_method as PrayerMethod | null,
    ramadanMode: row.ramadan_mode,
    ramadanReductionPercent: row.ramadan_reduction_pct,
    ramadanStart: row.ramadan_start,
    ramadanEnd: row.ramadan_end,
    ramadanStudyStart: row.ramadan_study_start ? row.ramadan_study_start.slice(0, 5) : null,
    showHijri: row.show_hijri,
  };
}

/**
 * The student's local calendar settings and when a planning rule last changed. No row yet, or a database that
 * doesn't have the table yet (code deployed before migration 0022), means the defaults: everything off.
 */
export async function getCalendarState(supabase: ServerSupabase, ownerId?: string): Promise<{ prefs: LocalCalendarPrefs; rulesChangedAt: string | null }> {
  let query = supabase.from("calendar_prefs").select(COLUMNS);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return { prefs: DEFAULT_LOCAL_CALENDAR, rulesChangedAt: null };
    throw fromDbError(error);
  }
  return data ? { prefs: toPrefs(data), rulesChangedAt: data.rules_changed_at } : { prefs: DEFAULT_LOCAL_CALENDAR, rulesChangedAt: null };
}

export async function getCalendarPrefs(supabase: ServerSupabase, ownerId?: string): Promise<LocalCalendarPrefs> {
  return (await getCalendarState(supabase, ownerId)).prefs;
}

/** owner_id comes from the column default (auth.uid()); students can write only the settings columns. */
export async function saveCalendarPrefs(supabase: ServerSupabase, prefs: LocalCalendarPrefs): Promise<LocalCalendarPrefs> {
  const { data, error } = await supabase
    .from("calendar_prefs")
    .upsert(
      {
        friday_prayer: prefs.fridayPrayer,
        prayer_breaks: prefs.prayerBreaks,
        prayer_city: prefs.city,
        prayer_method: prefs.method,
        ramadan_mode: prefs.ramadanMode,
        ramadan_reduction_pct: prefs.ramadanReductionPercent,
        ramadan_start: prefs.ramadanStart,
        ramadan_end: prefs.ramadanEnd,
        ramadan_study_start: prefs.ramadanStudyStart,
        show_hijri: prefs.showHijri,
      },
      { onConflict: "owner_id" },
    )
    .select(COLUMNS)
    .single();
  if (error) {
    if (isMissingSchema(error)) throw new ApiError(503, "not_available", "Local calendar settings aren't available yet. Please try again later.");
    throw fromDbError(error);
  }
  return toPrefs(data);
}
