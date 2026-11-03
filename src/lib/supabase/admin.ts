import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Privileged client (bypasses RLS). Only for trusted server pipelines (document ingestion, writing agent
 * runs/proposals) and ONLY after the caller verified ownership with the student's own client.
 * Never pass it to agent tools or return its results without scoping by the verified owner_id.
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("SUPABASE_SECRET_KEY is not configured on the server");
  return createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type AdminSupabase = ReturnType<typeof adminClient>;
