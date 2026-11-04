import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyRunError, shouldFallBack } from "@/lib/agents/recovery-agent";
import { runtimeInfo } from "@/lib/agents/runtime";

afterEach(() => vi.unstubAllEnvs());

const err = (fields: Record<string, unknown>) => Object.assign(new Error(String(fields.message ?? "x")), fields);

describe("model fallback: error classification", () => {
  it("tells a daily quota apart from a per-minute limit", () => {
    expect(classifyRunError(err({ status: 429, message: "Quota exceeded for metric GenerateRequestsPerDayPerProjectPerModel" }))).toBe("model_quota");
    expect(classifyRunError(err({ status: 429, message: "Resource exhausted, retry in 20s" }))).toBe("model_busy");
  });

  it("classifies overload and provider timeouts", () => {
    expect(classifyRunError(err({ status: 503, message: "The model is overloaded" }))).toBe("model_overloaded");
    expect(classifyRunError(err({ status: 500, message: "internal" }))).toBe("model_overloaded");
    expect(classifyRunError(err({ name: "APIConnectionTimeoutError", message: "Request timed out." }))).toBe("provider_timeout");
  });

  it("keeps the existing codes for everything else", () => {
    expect(classifyRunError(err({ status: 400, message: "bad request" }))).toBe("model_error");
    expect(classifyRunError(err({ code: "invalid_output" }))).toBe("invalid_output");
    expect(classifyRunError(err({ name: "MaxTurnsExceededError" }))).toBe("max_turns");
  });

  it("falls back only on quota, overload and timeouts — never on bad output, loops or cancellation", () => {
    for (const code of ["model_quota", "model_busy", "model_overloaded", "provider_timeout", "attempt_timeout"]) expect(shouldFallBack(code)).toBe(true);
    for (const code of ["model_error", "invalid_output", "max_turns", "cancelled", "timeout"]) expect(shouldFallBack(code)).toBe(false);
  });
});

describe("model fallback: configuration", () => {
  const gemini = () => {
    vi.stubEnv("CATCHUP_TEST_MODEL", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-not-real");
    vi.stubEnv("GEMINI_MODEL", "gemini-primary");
  };

  it("has no fallback unless GEMINI_FALLBACK_MODEL is set", () => {
    gemini();
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "");
    expect(runtimeInfo()).toEqual({ kind: "gemini", model: "gemini-primary" });
  });

  it("exposes the second Gemini model, which has its own daily quota", () => {
    gemini();
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-second");
    expect(runtimeInfo()).toEqual({ kind: "gemini", model: "gemini-primary", fallbackModel: "gemini-second" });
  });

  it("ignores a fallback that names the primary model (it would share the quota)", () => {
    gemini();
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-primary");
    expect(runtimeInfo()).toEqual({ kind: "gemini", model: "gemini-primary" });
  });
});
