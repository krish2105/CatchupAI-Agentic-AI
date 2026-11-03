/**
 * Structured, privacy-conscious logs: one JSON line per event on stdout/stderr, which Vercel keeps in its
 * runtime logs. Never pass document text, messages, emails, tokens or keys; anything that looks like a secret
 * or an email address is redacted before writing, as a safety net.
 */
type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

const SECRET_KEY = /(token|secret|password|authorization|cookie|key|email|content|message|text|snippet)/i;
const EMAIL = /[^\s@"]+@[^\s@"]+\.[a-z]{2,}/gi;
const SECRETISH = /\b(sk-[A-Za-z0-9_-]{8,}|sb_secret_[A-Za-z0-9_-]{8,}|cu_mcp_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g;

export function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (SECRET_KEY.test(k)) out[k] = "[redacted]";
    else if (typeof v === "string") out[k] = v.replace(EMAIL, "[email]").replace(SECRETISH, "[secret]").slice(0, 300);
    else out[k] = v;
  }
  return out;
}

export function logEvent(level: Level, event: string, fields: Fields = {}) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    event,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    ...redact(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
