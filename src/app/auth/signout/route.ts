import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Local scope: end this browser session only (other devices stay signed in).
  await supabase.auth.signOut({ scope: "local" });
  const form = await request.formData().catch(() => null);
  // Only the login page is an allowed destination besides home (no open redirects).
  const destination = form?.get("next") === "/login" ? "/login" : "/";
  return NextResponse.redirect(new URL(destination, request.url), { status: 303 });
}
