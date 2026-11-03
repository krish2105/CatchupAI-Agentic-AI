import "server-only";
import { z } from "zod";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";

export const memoryText = z.string().trim().min(3).max(280);
export const MAX_PENDING_SUGGESTIONS = 10;

export type MemoryDto = { id: string; text: string; status: "suggested" | "confirmed"; source: "student" | "copilot"; createdAt: string };

const toDto = (r: { id: string; text: string; status: string; source: string; created_at: string }): MemoryDto => ({
  id: r.id,
  text: r.text,
  status: r.status as MemoryDto["status"],
  source: r.source as MemoryDto["source"],
  createdAt: r.created_at,
});

export async function listMemories(supabase: ServerSupabase): Promise<MemoryDto[]> {
  const { data, error } = await supabase.from("copilot_memories").select("id, text, status, source, created_at").order("created_at");
  if (error) throw fromDbError(error);
  return data.map(toDto);
}

/** A memory the student writes themselves is confirmed straight away. */
export async function addMemory(supabase: ServerSupabase, text: string): Promise<MemoryDto> {
  const { data, error } = await supabase.from("copilot_memories").insert({ text: memoryText.parse(text) }).select("id, text, status, source, created_at").single();
  if (error) throw error.code === "23514" ? new ApiError(400, "memory_limit", "You can keep up to 40 memories. Delete one first.") : fromDbError(error);
  return toDto(data);
}

export async function updateMemory(supabase: ServerSupabase, id: string, patch: { text?: string; confirm?: true }): Promise<MemoryDto> {
  const update: { text?: string; status?: "confirmed" } = {};
  if (patch.text !== undefined) update.text = memoryText.parse(patch.text);
  if (patch.confirm) update.status = "confirmed";
  const { data, error } = await supabase.from("copilot_memories").update(update).eq("id", id).select("id, text, status, source, created_at").single();
  if (error) throw fromDbError(error, "Memory not found.");
  return toDto(data);
}

export async function deleteMemory(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase.from("copilot_memories").delete().eq("id", id).select("id");
  if (error) throw fromDbError(error);
  if (!data.length) throw new ApiError(404, "not_found", "Memory not found.");
}

/** What the copilot may use: confirmed memories only. Filters by owner, so it is safe with the admin client. */
export async function confirmedMemories(db: ServerSupabase | AdminSupabase, ownerId: string): Promise<string[]> {
  const { data, error } = await db.from("copilot_memories").select("text").eq("owner_id", ownerId).eq("status", "confirmed").order("created_at").limit(40);
  if (error) throw fromDbError(error);
  return data.map((m) => m.text);
}

/**
 * The copilot's suggestion, stored as "suggested" until the student confirms it. Written with the admin client
 * for the verified owner (students can't create suggestions themselves). Duplicates are ignored.
 */
export async function suggestMemory(admin: AdminSupabase, ownerId: string, text: string): Promise<"saved" | "duplicate" | "full"> {
  const clean = memoryText.parse(text);
  const { data, error } = await admin.from("copilot_memories").select("text, status").eq("owner_id", ownerId);
  if (error) throw fromDbError(error);
  if (data.some((m) => m.text.toLowerCase() === clean.toLowerCase())) return "duplicate";
  if (data.filter((m) => m.status === "suggested").length >= MAX_PENDING_SUGGESTIONS || data.length >= 40) return "full";
  const inserted = await admin.from("copilot_memories").insert({ owner_id: ownerId, text: clean, status: "suggested", source: "copilot" });
  if (inserted.error) throw fromDbError(inserted.error);
  return "saved";
}
