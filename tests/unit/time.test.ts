import { describe, expect, it } from "vitest";
import { formatMinutes, isoToLocalInput, localInputToIso } from "@/lib/time";

describe("time zone conversion", () => {
  it("converts Dubai wall-clock to UTC", () => {
    expect(localInputToIso("2026-11-13T16:00", "Asia/Dubai")).toBe("2026-11-13T12:00:00.000Z");
  });

  it("round-trips across a DST change (New York, 2026-11-01)", () => {
    const before = localInputToIso("2026-10-31T18:00", "America/New_York");
    const after = localInputToIso("2026-11-02T18:00", "America/New_York");
    expect(before).toBe("2026-10-31T22:00:00.000Z");
    expect(after).toBe("2026-11-02T23:00:00.000Z");
    expect(isoToLocalInput(after, "America/New_York")).toBe("2026-11-02T18:00");
  });

  it("rejects malformed input", () => {
    expect(() => localInputToIso("13/11/2026 16:00", "UTC")).toThrow(RangeError);
  });

  it("formats minutes", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(150)).toBe("2h 30m");
  });
});
