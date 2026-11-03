import { expect } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Reads the newest 6-digit sign-in code sent to `email` by local Supabase Auth (Mailpit). */
export async function latestCode(email: string, after = 0): Promise<string> {
  let code: string | null = null;
  await expect
    .poll(async () => {
      const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`).then((r) => r.json());
      const message = search.messages?.[0];
      if (!message || Date.parse(message.Created) < after) return null;
      const full = await fetch(`${MAILPIT}/api/v1/message/${message.ID}`).then((r) => r.json());
      code = /\b(\d{6})\b/.exec(full.Text)?.[1] ?? null;
      return code;
    }, { timeout: 15_000 })
    .not.toBeNull();
  return code!;
}
