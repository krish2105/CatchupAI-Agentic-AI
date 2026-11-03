import { calendarFor, ownerForToken } from "@/lib/calendar/service";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Public, token-addressed calendar feed for calendar apps (which can't sign in). The 256-bit token is the
 * credential; unknown or revoked tokens get the same 404 as malformed ones.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const admin = adminClient();
  const owner = await ownerForToken(admin, (await params).token.replace(/\.ics$/, ""));
  if (!owner) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  const ics = await calendarFor(admin, owner, Date.now());
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" } });
}
