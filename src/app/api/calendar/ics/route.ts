import { requireApiUser } from "@/lib/auth/session";
import { calendarFor } from "@/lib/calendar/service";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";

/** Downloads the signed-in student's plan and deadlines as an .ics file. */
export const GET = route(async () => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "compute");
  const ics = await calendarFor(supabase, user.id, Date.now());
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="catchup-ai-plan.ics"' } });
});
