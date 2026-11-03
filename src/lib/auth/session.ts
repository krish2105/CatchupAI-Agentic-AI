import "server-only";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http/errors";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string };

/** Identity comes only from the verified JWT claims of the current request. */
async function readUser(supabase: ServerSupabase): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  return { id: sub, email: typeof data.claims.email === "string" ? data.claims.email : "" };
}

/** For Server Components / pages: redirects to /login when signed out. */
export async function requirePageUser(next = "/dashboard") {
  const supabase = await createClient();
  const user = await readUser(supabase);
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

/** For Route Handlers: throws a 401 ApiError when signed out. */
export async function requireApiUser() {
  const supabase = await createClient();
  const user = await readUser(supabase);
  if (!user) throw new ApiError(401, "unauthenticated", "Sign in to continue.");
  return { supabase, user };
}
