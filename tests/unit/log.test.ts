import { describe, expect, it, vi } from "vitest";
import { logEvent, redact } from "@/lib/observability/log";

describe("structured logs", () => {
  it("redacts secret-looking keys, emails and tokens", () => {
    const out = redact({ apiKey: "x", email: "a@b.co", userEmail: "x", note: "contact a.student@uni.edu with sk-abcdefghijklmnop and cu_mcp_abcdefghijklmnop", count: 3 });
    expect(out.apiKey).toBe("[redacted]");
    expect(out.email).toBe("[redacted]");
    expect(out.userEmail).toBe("[redacted]");
    expect(out.note).toBe("contact [email] with [secret] and [secret]");
    expect(out.count).toBe(3);
  });

  it("writes one JSON line with level, event and version", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logEvent("error", "api.error", { status: 500, path: "/api/x" });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "error", event: "api.error", status: 500, path: "/api/x", version: "local" });
    spy.mockRestore();
  });
});
