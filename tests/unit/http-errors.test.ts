import { describe, expect, it } from "vitest";
import { fromDbError } from "@/lib/http/errors";

describe("fromDbError", () => {
  it.each(["PGRST301", "PGRST302", "PGRST303"])("treats rejected JWTs (%s) as an expired session, not a server error", (code) => {
    const err = fromDbError({ code, message: "JWT expired" });
    expect(err.status).toBe(401);
    expect(err.code).toBe("session_expired");
  });

  it("never forwards raw database messages", () => {
    const err = fromDbError({ code: "XX000", message: "secret internals" });
    expect(err.status).toBe(500);
    expect(err.message).not.toContain("secret");
  });
});
