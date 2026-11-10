import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { scriptedRuntimeAllowed } from "@/lib/agents/runtime";
import { runCheckins, type CheckinResult } from "@/lib/checkin/service";
import { nudgeMailer } from "@/lib/nudges/mailer";
import { sendDueNudges } from "@/lib/nudges/service";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Daily job, called by the scheduler with `Authorization: Bearer $CRON_SECRET`:
 * 1. proactive check-ins (drafts a re-plan for students who are slipping; never approves anything), always;
 * 2. opt-in study nudges, only when SMTP is configured. Each message carries RFC 8058 one-click unsubscribe
 *    headers as well as a visible link.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const now = Date.now();
  // Local automated tests only (same gate as the scripted model): limit the run to one student, so parallel tests
  // never get drafts they didn't ask for. Ignored in every deployed environment.
  const owner = new URL(request.url).searchParams.get("owner");
  const only = scriptedRuntimeAllowed() && owner && /^[0-9a-f-]{36}$/i.test(owner) ? [owner] : undefined;
  let checkins: CheckinResult | { error: "failed" };
  try {
    checkins = await runCheckins({ admin: adminClient(), now, ownerIds: only });
  } catch {
    checkins = { error: "failed" };
  }
  const mailer = nudgeMailer();
  if (!mailer) return NextResponse.json({ checkins, nudges: { skipped: "mail_not_configured" } });
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const nudges = await sendDueNudges({
    admin: adminClient(),
    now,
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
  return NextResponse.json({ checkins, nudges });
}

/** Constant-time comparison so response timing doesn't reveal how much of the secret matched. */
function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
