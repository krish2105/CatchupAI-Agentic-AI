import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDisclosure, type DisclosureInput } from "@/lib/disclosure/build";
import { scrubPersonalData } from "@/lib/privacy/scrub";
import { TRUST_CONTROLS } from "@/lib/quality/trust-controls";
import { profileUpdate } from "@/lib/validation/schemas";

describe("personal-data scrubber (before any prompt)", () => {
  it("masks email addresses, UAE and international phone numbers and Emirates ID numbers", () => {
    const { text, found } = scrubPersonalData(
      "I'm sara.k+uni@student.ac.ae, call +971 50 123 4567 or 050-765-4321 or 00971501234567, UK +44 20 7946 0958. My ID is 784-1990-1234567-1 (also 784199012345671).",
    );
    expect(text).toBe(
      "I'm [email removed], call [phone removed] or [phone removed] or [phone removed], UK [phone removed]. My ID is [Emirates ID removed] (also [Emirates ID removed]).",
    );
    expect(found).toEqual({ emails: 1, phones: 4, emiratesIds: 2 });
  });

  it("leaves study details alone: dates, times, page ranges, minutes and chapter numbers", () => {
    const message = "My worksheet is due 2026-11-13 at 23:59, Friday 12:00-14:00 is free, read pp. 2-3 and chapter 784, about 120 minutes; quiz 3 of 10.";
    expect(scrubPersonalData(message)).toEqual({ text: message, found: { emails: 0, phones: 0, emiratesIds: 0 } });
  });
});

describe("age check at onboarding", () => {
  it("only completes onboarding for a student who confirms they are 13 or older", () => {
    expect(profileUpdate.safeParse({ completeOnboarding: true }).success).toBe(false);
    expect(profileUpdate.safeParse({ completeOnboarding: true, ageConfirmed: false }).success).toBe(false);
    expect(profileUpdate.safeParse({ completeOnboarding: true, ageConfirmed: true }).success).toBe(true);
    // Ordinary profile edits later don't ask again.
    expect(profileUpdate.safeParse({ timezone: "Asia/Dubai" }).success).toBe(true);
  });
});

describe("AI-use disclosure", () => {
  const input: DisclosureInput = {
    generatedAt: "2026-11-09T10:00:00.000Z",
    timezone: "Asia/Dubai",
    runs: [
      {
        createdAt: "2026-11-08T09:00:00.000Z",
        question: "Explain residuals from my notes",
        model: "gemini-3.6-flash",
        facts: [{ statement: "A residual is the observed value minus the predicted value.", sources: [{ filename: "module4.pdf", page: 2 }] }],
        suggestions: ["Practise two residual plots."],
        offTopic: false,
      },
      { createdAt: "2026-11-08T10:00:00.000Z", question: "Write me a poem", model: "gemini-3.6-flash", facts: [], suggestions: [], offTopic: true },
    ],
    plans: [
      { createdAt: "2026-11-08T09:01:00.000Z", origin: "copilot", scenario: "balanced", status: "approved", decidedAt: "2026-11-08T09:05:00.000Z" },
      { createdAt: "2026-11-09T06:30:00.000Z", origin: "check-in", scenario: "essential", status: "rejected", decidedAt: "2026-11-09T07:00:00.000Z" },
      { createdAt: "2026-11-07T08:00:00.000Z", origin: "student", scenario: "full", status: "expired", decidedAt: null },
    ],
    memories: [{ text: "I study best in the evening", createdAt: "2026-11-07T08:00:00.000Z" }],
  };

  it("lists what the AI drafted, its sources and what the student approved", () => {
    const md = buildDisclosure(input);
    expect(md).toMatch(/^# AI-use disclosure/);
    expect(md).toContain("Explain residuals from my notes");
    expect(md).toContain("module4.pdf, p. 2");
    expect(md).toContain("gemini-3.6-flash");
    expect(md).toContain("Approved by the student");
    expect(md).toContain("Dismissed by the student");
    expect(md).toMatch(/copilot/i);
    expect(md).toMatch(/daily check-in/i);
    expect(md).toContain("I study best in the evening");
    expect(md).toMatch(/built without AI/i);
    expect(md).toMatch(/outside what the copilot helps with/i);
    expect(md).not.toContain("Write me a poem\n\n- ");
  });

  it("says so plainly when the AI wasn't used", () => {
    expect(buildDisclosure({ ...input, runs: [], plans: [], memories: [] })).toMatch(/No AI use is recorded/);
  });
});

describe("Built for UAE rules (public trust panel)", () => {
  it("links every control to code and a test that exist in the repository", () => {
    expect(TRUST_CONTROLS.length).toBeGreaterThanOrEqual(6);
    for (const c of TRUST_CONTROLS) {
      for (const path of [c.code, c.test]) expect(existsSync(path), `${c.title}: ${path}`).toBe(true);
    }
  });
});
