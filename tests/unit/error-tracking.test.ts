import { describe, expect, it } from "vitest";
import { errorFingerprint, normalizeErrorPath, redactErrorText, ReportThrottle } from "@/lib/observability/error-text";

describe("error tracking: redaction", () => {
  it("removes secrets and personal data before anything is stored", () => {
    const raw = [
      "failed for jane.doe@example.com",
      "key AIzaSyA1234567890abcdefghijklmnopqrstuv",
      "openai sk-proj-abcdefghijklmnop",
      "supabase sb_secret_abcdefghijklmnop",
      "mcp cu_mcp_abcdefghijklmnop",
      "Authorization: Bearer abc.def-ghi_jkl",
      "jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      "row 3f2b8c1e-9a7d-4e21-b3c4-5d6e7f8a9b0c",
      "card 4111111111111111 phone +971501234567",
      "url https://x.supabase.co/storage/v1/object/sign/doc.pdf?token=abc&exp=1",
      "from 10.10.11.119",
    ].join(" | ");
    const out = redactErrorText(raw);
    for (const leaked of ["jane.doe", "AIzaSy", "sk-proj", "sb_secret_", "cu_mcp_", "abc.def-ghi", "eyJhbGci", "3f2b8c1e", "4111111111111111", "501234567", "token=abc", "10.10.11.119"]) {
      expect(out).not.toContain(leaked);
    }
    expect(out).toContain("[email]");
    expect(out).toContain("[secret]");
    expect(out).toContain("<id>");
    expect(out).toContain("https://x.supabase.co/storage/v1/object/sign/doc.pdf?[query]");
  });

  it("caps the length", () => {
    expect(redactErrorText("x".repeat(5000), 500)).toHaveLength(500);
  });
});

describe("error tracking: grouping", () => {
  it("normalises ids in paths", () => {
    expect(normalizeErrorPath("/runs/3f2b8c1e-9a7d-4e21-b3c4-5d6e7f8a9b0c?x=1")).toBe("/runs/:id");
    expect(normalizeErrorPath("/api/calendar/feed/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ")).toBe("/api/calendar/feed/:token");
    expect(normalizeErrorPath("/api/documents/12/source")).toBe("/api/documents/:n/source");
  });

  it("groups the same failure regardless of ids, numbers or personal data in the message", () => {
    const a = errorFingerprint({ source: "route", path: "/runs/3f2b8c1e-9a7d-4e21-b3c4-5d6e7f8a9b0c", name: "TypeError", message: "Cannot read 3 of row 3f2b8c1e-9a7d-4e21-b3c4-5d6e7f8a9b0c for a@b.co" });
    const b = errorFingerprint({ source: "route", path: "/runs/00000000-0000-4000-8000-000000000000", name: "TypeError", message: "Cannot read 7 of row 00000000-0000-4000-8000-000000000000 for c@d.org" });
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).toBe(b);
  });

  it("separates different failures", () => {
    const base = { source: "route" as const, path: "/api/x", name: "TypeError", message: "boom" };
    const fp = errorFingerprint(base);
    expect(errorFingerprint({ ...base, name: "RangeError" })).not.toBe(fp);
    expect(errorFingerprint({ ...base, path: "/api/y" })).not.toBe(fp);
    expect(errorFingerprint({ ...base, source: "boundary" })).not.toBe(fp);
  });
});

describe("error tracking: report throttle", () => {
  it("allows a burst per key, then refuses until the window passes", () => {
    let t = 0;
    const throttle = new ReportThrottle(3, 60_000, () => t);
    expect([1, 2, 3, 4].map(() => throttle.allow("u1"))).toEqual([true, true, true, false]);
    expect(throttle.allow("u2")).toBe(true);
    t = 60_001;
    expect(throttle.allow("u1")).toBe(true);
  });
});
