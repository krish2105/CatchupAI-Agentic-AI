import { createHmac, timingSafeEqual } from "node:crypto";

/** One-click unsubscribe links: an HMAC of the student id, so nothing needs storing and links can't be forged. */
const secret = () => process.env.CRON_SECRET ?? "";

export function unsubscribeSignature(userId: string) {
  return createHmac("sha256", secret()).update(`unsubscribe:${userId}`).digest("base64url");
}

export function verifyUnsubscribe(userId: string, signature: string) {
  if (!secret()) return false;
  const expected = Buffer.from(unsubscribeSignature(userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
