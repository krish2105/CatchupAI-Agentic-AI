import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDigest } from "@/lib/nudges/digest";
import { unsubscribeSignature, verifyUnsubscribe } from "@/lib/nudges/sign";

afterEach(() => vi.unstubAllEnvs());
const base = { name: "Alex", timezone: "Asia/Kolkata", today: [], missed: [], deadlines: [], appUrl: "https://app.example", unsubscribeUrl: "https://app.example/u", wantsDigest: true, wantsMissed: true };

describe("nudge emails", () => {
  it("sends nothing when there's nothing to say", () => {
    expect(buildDigest(base)).toBeNull();
    expect(buildDigest({ ...base, wantsMissed: false, missed: [{ title: "x", minutes: 30 }] })).toBeNull();
  });

  it("leads with a missed-block alert linking to the replan, and always includes unsubscribe", () => {
    const mail = buildDigest({ ...base, missed: [{ title: "Read p. 2", minutes: 45 }], today: [{ title: "Worksheet <1>", startsAt: "2026-11-05T12:30:00Z", minutes: 60 }] })!;
    expect(mail.subject).toBe("CatchUp AI · Let's get back on track today");
    expect(mail.text).toContain("You missed 1 study block (45 min)");
    expect(mail.text).toContain("18:00 Worksheet <1> (60 min)");
    expect(mail.html).toContain("Worksheet &lt;1&gt;");
    expect(mail.html).toContain("/recovery?replan=1");
    expect(mail.text).toContain("Stop them: https://app.example/u");
  });

  it("signs unsubscribe links so they can't be forged for another student", () => {
    vi.stubEnv("CRON_SECRET", "x".repeat(40));
    const sig = unsubscribeSignature("user-a");
    expect(verifyUnsubscribe("user-a", sig)).toBe(true);
    expect(verifyUnsubscribe("user-b", sig)).toBe(false);
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyUnsubscribe("user-a", sig)).toBe(false);
  });
});
