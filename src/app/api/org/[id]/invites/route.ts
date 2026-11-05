import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { logEvent } from "@/lib/observability/log";
import { nudgeMailer } from "@/lib/nudges/mailer";
import { createInvite, inviteBody } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

/**
 * Admin invites an email address. Returns the one-time link (shown once to the admin) and whether it was also
 * emailed (only when SMTP is configured). The address itself is never stored, only its hash.
 */
export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  await enforceRateLimit(supabase, "write");
  const { email, role } = inviteBody.parse(await readJson(request, 2048));
  const orgId = uuid.parse((await params).id);
  const { token } = await createInvite(supabase, orgId, email, role);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const link = `${appUrl}/org?invite=${token}`;
  let emailed = false;
  const mailer = nudgeMailer();
  if (mailer) {
    try {
      await mailer.transport.sendMail({
        from: mailer.from,
        to: email,
        subject: "You're invited to an organisation on CatchUp AI",
        text: `You've been invited to join an organisation on CatchUp AI as a ${role}.\n\nSign in with this email address, then open this link within 7 days:\n${link}\n\nTeachers only ever see class totals from students who choose to share them, never your notes, answers or plans.\nIf you didn't expect this, ignore this email.`,
      });
      emailed = true;
    } catch {
      logEvent("warn", "org.invite_email_failed", { orgId });
    }
  }
  return NextResponse.json({ link, emailed }, { status: 201 });
});
