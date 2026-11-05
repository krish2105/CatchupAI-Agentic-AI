import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/billing/service";
import { billingConfig } from "@/lib/billing/stripe";
import { ApiError, route } from "@/lib/http/errors";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Stripe → CatchUp AI. No session: the Stripe-Signature HMAC over the raw body is the authentication, so the
 * body must be read as text before any parsing. Stripe sends no Origin header, so the proxy's cross-site check
 * doesn't apply. 400 for a bad signature, 200 for every verified event (applied or ignored).
 */
export const POST = route(async (request: Request) => {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 512 * 1024) throw new ApiError(413, "too_large", "Payload too large.");
  const raw = await request.text();
  if (raw.length > 512 * 1024) throw new ApiError(413, "too_large", "Payload too large.");
  return NextResponse.json(await handleStripeWebhook(raw, request.headers.get("stripe-signature"), adminClient(), billingConfig()));
});
