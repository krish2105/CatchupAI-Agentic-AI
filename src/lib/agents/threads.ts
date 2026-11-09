import "server-only";
import { ApiError, fromDbError, isMissingSchema } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";

/** A short title from the first message of a conversation. */
export function threadTitle(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length <= 80 ? oneLine : `${oneLine.slice(0, 79).trimEnd()}…`;
}

/**
 * The conversation for this request. An existing thread must belong to the student (read through their own RLS
 * client, so another student's id is simply not found); without one a new thread is created by the server with
 * the owner from the verified session. Returns null on a database without migration 0024 (single-turn as before).
 */
export async function resolveThread(supabase: ServerSupabase, admin: AdminSupabase, userId: string, threadId: string | null, message: string): Promise<string | null> {
  if (threadId) {
    const { data, error } = await supabase.from("copilot_threads").select("id").eq("id", threadId).maybeSingle();
    if (error) {
      if (isMissingSchema(error)) return null;
      throw fromDbError(error);
    }
    if (!data) throw new ApiError(404, "not_found", "Conversation not found.");
    await admin.from("copilot_threads").update({ updated_at: new Date().toISOString() }).eq("id", data.id).eq("owner_id", userId);
    return data.id;
  }
  const { data, error } = await admin.from("copilot_threads").insert({ owner_id: userId, title: threadTitle(message) }).select("id").single();
  if (error) {
    if (isMissingSchema(error)) return null;
    throw fromDbError(error);
  }
  return data.id;
}

/** The student's most recent conversation, if any. */
export async function latestThread(supabase: ServerSupabase): Promise<{ id: string; title: string } | null> {
  const { data, error } = await supabase.from("copilot_threads").select("id, title").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return null;
    throw fromDbError(error);
  }
  return data;
}
