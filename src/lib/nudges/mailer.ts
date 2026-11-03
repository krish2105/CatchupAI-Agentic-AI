import "server-only";
import nodemailer from "nodemailer";

/**
 * Outgoing mail for nudges. SMTP_* must be set (production: the same Gmail/Resend account as sign-in);
 * NUDGE_TRANSPORT=json captures messages instead of sending them (tests only). Returns null when unconfigured.
 */
export function nudgeMailer() {
  if (process.env.NUDGE_TRANSPORT === "json") return { transport: nodemailer.createTransport({ jsonTransport: true }), from: "CatchUp AI <test@catchup.local>" };
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 465);
  return {
    transport: nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } }),
    from: `CatchUp AI <${SMTP_FROM || SMTP_USER}>`,
  };
}
