import { createHash } from "node:crypto";

/**
 * Pure helpers for self-hosted error tracking: redaction (applied before anything is stored), path
 * normalisation and a stable fingerprint so the same failure groups together whatever ids, numbers or
 * personal data appear in its message.
 */
const RULES: [RegExp, string][] = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [secret]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[secret]"],
  [/\b(?:sk-[A-Za-z0-9_-]{8,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}|cu_mcp_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,})/g, "[secret]"],
  [/[^\s@"'<>()[\]]+@[^\s@"'<>()[\]]+\.[a-z]{2,}/gi, "[email]"],
  [/(https?:\/\/[^\s?#"']+)\?[^\s#"']*/gi, "$1?[query]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<ip>"],
  [/\+?\d[\d -]{6,}\d/g, "<n>"],
];

export function redactErrorText(text: string, max = 500): string {
  let out = String(text);
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out.slice(0, max);
}

/** `/runs/<uuid>?x` → `/runs/:id`; long random segments → `:token`; numeric segments → `:n`. */
export function normalizeErrorPath(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  return clean
    .split("/")
    .map((seg) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) ? ":id" : /^\d+$/.test(seg) ? ":n" : /^[A-Za-z0-9_-]{24,}$/.test(seg) ? ":token" : seg))
    .join("/")
    .slice(0, 200);
}

export type ErrorSource = "route" | "boundary" | "agent" | "cron";

export function errorFingerprint(e: { source: ErrorSource; path: string; name: string; message: string }): string {
  // Numbers and redaction placeholders are folded so "row 3" and "row 7" are one group.
  const message = redactErrorText(e.message, 200).replace(/\d+/g, "N");
  return createHash("sha256").update([e.source, normalizeErrorPath(e.path), e.name, message].join("\u0000")).digest("hex").slice(0, 16);
}

/** Per-key fixed-window limit for browser error reports (per server instance). */
export class ReportThrottle {
  private readonly hits = new Map<string, { start: number; count: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}
  allow(key: string): boolean {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t - entry.start > this.windowMs) {
      this.hits.set(key, { start: t, count: 1 });
      if (this.hits.size > 5000) this.hits.delete(this.hits.keys().next().value as string);
      return true;
    }
    entry.count++;
    return entry.count <= this.limit;
  }
}
