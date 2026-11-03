import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GUARD = "catchup-session-recovery";

/**
 * Reached when the database rejected an access token that still looked valid locally
 * (expired, or signed by a rotated key). Tries one refresh; otherwise signs out to /login.
 * Safe as GET: it never ends a session the auth server still accepts.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { error: invalid } = await supabase.auth.getUser();
  const retried = request.cookies.has(GUARD);

  if (invalid || retried) {
    const { error: refreshFailed } = retried ? { error: true } : await supabase.auth.refreshSession();
    if (refreshFailed) {
      await supabase.auth.signOut({ scope: "local" });
      const response = NextResponse.redirect(new URL("/login?next=%2Fdashboard", request.url), { status: 303 });
      response.cookies.delete(GUARD);
      return response;
    }
  }
  // A second visit within 30 s means refreshing didn't help: the next one signs out instead of looping.
  const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  response.cookies.set(GUARD, "1", { maxAge: 30, httpOnly: true, sameSite: "lax", path: "/auth/refresh" });
  return response;
}
