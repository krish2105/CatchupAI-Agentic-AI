import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { nudgeMailer } from "@/lib/nudges/mailer";
import { sendDueNudges } from "@/lib/nudges/service";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Daily opt-in study nudges. Called by the scheduler with `Authorization: Bearer $CRON_SECRET`.
 * Each message carries RFC 8058 one-click unsubscribe headers as well as a visible link.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const mailer = nudgeMailer();
  if (!mailer) return NextResponse.json({ error: { code: "mail_not_configured", message: "SMTP_* is not set on the server." } }, { status: 503 });
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const result = await sendDueNudges({
    admin: adminClient(),
    now: Date.now(),
    appUrl,
    send: async (mail) => {
      await mailer.transport.sendMail({
        from: mailer.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: { "List-Unsubscribe": `<${mail.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
    },
  });
  return NextResponse.json(result);
}

/** Constant-time comparison so response timing doesn't reveal how much of the secret matched. */
function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
