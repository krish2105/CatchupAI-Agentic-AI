import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { startCheckout } from "@/lib/billing/service";
import { billingConfig } from "@/lib/billing/stripe";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";

const body = z.object({ orgId: z.uuid() }).strict();

/** Admin of an organisation → Stripe Checkout URL for the Class plan (test mode unless the owner allows live). */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const { orgId } = body.parse(await readJson(request, 1024));
  await enforceRateLimit(supabase, "write", user);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  return NextResponse.json({ url: await startCheckout({ supabase, orgId, email: user.email, appUrl }, billingConfig()) });
});
