import { NextResponse } from "next/server";
import { deleteUnderAgeAccount } from "@/lib/account/under-age";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { adminClient } from "@/lib/supabase/admin";

/** Onboarding answer "under 13": delete the just-created sign-in and sign out, so nothing is kept. */
export const POST = route(async () => {
  const { supabase, user } = await requireApiUser();
  await enforceRateLimit(supabase, "account");
  await deleteUnderAgeAccount(supabase, adminClient(), user.id);
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return NextResponse.json({ deleted: true });
});
