import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

if (!url || !publishable || !secret || !/127\.0\.0\.1|localhost/.test(url)) {
  throw new Error("Integration tests require the LOCAL Supabase stack (npm run db:start) and .env.local");
}

export type Db = SupabaseClient<Database>;

export function admin(): Db {
  return createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anon(): Db {
  return createClient<Database>(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Creates a confirmed user and returns a client signed in as them (magic-link token, no passwords). */
export async function signedInUser(label: string): Promise<{ id: string; email: string; db: Db }> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}@test.catchup.local`;
  const a = admin();
  const created = await a.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  const link = await a.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const db = anon();
  const verified = await db.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw verified.error;
  return { id: created.data.user.id, email, db };
}

export async function deleteUser(id: string) {
  await admin().auth.admin.deleteUser(id);
}

export function minimalPdf(text = "hello"): Uint8Array {
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n% ${text}\ntrailer<</Root 1 0 R>>\n%%EOF\n`;
  return new TextEncoder().encode(body);
}
