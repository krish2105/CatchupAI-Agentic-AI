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
  const openai = () => {
    vi.stubEnv("CATCHUP_TEST_MODEL", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
    vi.stubEnv("OPENAI_MODEL", "gpt-primary");
  };

  it("has no fallback unless OPENAI_FALLBACK_MODEL is set", () => {
    openai();
    vi.stubEnv("OPENAI_FALLBACK_MODEL", "");
    expect(runtimeInfo()).toEqual({ kind: "openai", model: "gpt-primary" });
  });

  it("exposes the second OpenAI model, tried once when the first hits its quota, is overloaded or times out", () => {
    openai();
    vi.stubEnv("OPENAI_FALLBACK_MODEL", "gpt-second");
    expect(runtimeInfo()).toEqual({ kind: "openai", model: "gpt-primary", fallbackModel: "gpt-second" });
  });

  it("ignores a fallback that names the primary model (it would share the quota)", () => {
    openai();
    vi.stubEnv("OPENAI_FALLBACK_MODEL", "gpt-primary");
    expect(runtimeInfo()).toEqual({ kind: "openai", model: "gpt-primary" });
  });
});
