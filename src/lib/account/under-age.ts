import "server-only";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * CatchUp AI is for students aged 13 and over (UAE Ministry of Education guidance on generative AI). A student who
 * says they are under 13 during onboarding gets a polite stop and their just-created sign-in is deleted at once,
 * so nothing about them is kept. Only for accounts that haven't finished onboarding: a set-up account is deleted
 * from Preferences instead, with its typed confirmation.
 */
export async function deleteUnderAgeAccount(supabase: ServerSupabase, admin: AdminSupabase, userId: string): Promise<void> {
  const { data: profile, error } = await supabase.from("profiles").select("onboarded_at").eq("id", userId).single();
  if (error) throw fromDbError(error, "Profile not found.");
  if (profile.onboarded_at) throw new ApiError(409, "already_onboarded", "This account is already set up. You can delete it from Preferences.");
  // A brand-new account has no files, but remove any the same way account deletion does.
  const { data: docs } = await supabase.from("documents").select("storage_path");
  const paths = (docs ?? []).map((d) => d.storage_path).filter((p): p is string => typeof p === "string" && p.startsWith(`${userId}/`));
  if (paths.length) await admin.storage.from("course-documents").remove(paths);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) throw new ApiError(500, "delete_failed", "Something went wrong. Please close this page.", deleteError.message);
}
