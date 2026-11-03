import "server-only";
import { fromDbError } from "@/lib/http/errors";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { ProfileUpdate } from "@/lib/validation/schemas";
import type { Profile } from "./types";

type Row = { id: string; display_name: string | null; timezone: string; weekly_minutes: number[]; study_start_time: string; onboarded_at: string | null };

function toProfile(row: Row): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    timezone: row.timezone,
    weeklyMinutes: row.weekly_minutes,
    studyStartTime: row.study_start_time.slice(0, 5),
    onboarded: row.onboarded_at !== null,
  };
}

const COLUMNS = "id, display_name, timezone, weekly_minutes, study_start_time, onboarded_at";

export async function getProfile(supabase: ServerSupabase, userId: string): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select(COLUMNS).eq("id", userId).single();
  if (error) throw fromDbError(error, "Profile not found.");
  return toProfile(data);
}

export async function updateProfile(supabase: ServerSupabase, userId: string, input: ProfileUpdate): Promise<Profile> {
  const patch: TablesUpdate<"profiles"> = {};
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.weeklyMinutes !== undefined) patch.weekly_minutes = input.weeklyMinutes;
  if (input.studyStartTime !== undefined) patch.study_start_time = input.studyStartTime;
  if (input.completeOnboarding) patch.onboarded_at = new Date().toISOString();
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", userId).select(COLUMNS).single();
  if (error) throw fromDbError(error, "Profile not found.");
  return toProfile(data);
}
