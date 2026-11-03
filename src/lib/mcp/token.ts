import "server-only";
import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/calendar/service";
import { fromDbError } from "@/lib/http/errors";
import type { AdminSupabase } from "@/lib/supabase/admin";

/** Personal MCP tokens look like `cu_mcp_` + 43 url-safe characters; only their SHA-256 is stored. */
export const MCP_TOKEN_PATTERN = /^cu_mcp_[A-Za-z0-9_-]{43}$/;

/** Creates (or replaces) the student's token. Returned once; the old token stops working immediately. */
export async function rotateMcpToken(admin: AdminSupabase, ownerId: string) {
  const token = `cu_mcp_${randomBytes(32).toString("base64url")}`;
  const { error } = await admin.from("mcp_tokens").upsert({ owner_id: ownerId, token_hash: hashToken(token), created_at: new Date().toISOString(), last_used_at: null });
  if (error) throw fromDbError(error);
  return token;
}

export async function ownerForMcpToken(admin: AdminSupabase, token: string): Promise<string | null> {
  if (!MCP_TOKEN_PATTERN.test(token)) return null;
  const { data } = await admin.from("mcp_tokens").select("owner_id, last_used_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!data) return null;
  // Record use at most once a minute (shown to the student in Preferences).
  if (!data.last_used_at || Date.now() - Date.parse(data.last_used_at) > 60_000) {
    await admin.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("owner_id", data.owner_id);
  }
  return data.owner_id;
}
