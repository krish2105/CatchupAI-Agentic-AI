import "server-only";
import { modelRuntime } from "./recovery-agent";
import { scriptedRuntime } from "./testing/e2e-script";

/**
 * The scripted test runtime is allowed only when explicitly requested AND the app talks to a local
 * Supabase stack — never in a deployed environment.
 */
export function scriptedRuntimeAllowed() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return process.env.CATCHUP_TEST_MODEL === "scripted" && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
}

export type RuntimeInfo = { kind: "openai"; model: string; fallbackModel?: string } | { kind: "scripted"; model: string } | { kind: "none" };

/**
 * An explicit local test request (CATCHUP_TEST_MODEL=scripted on a local stack) wins over a real key in
 * .env.local, so automated tests never spend the model quota. Deployed environments can't enable it.
 */
export function runtimeInfo(): RuntimeInfo {
  if (scriptedRuntimeAllowed()) return { kind: "scripted", model: "scripted-test-model" };
  const real = modelRuntime();
  if (real) return { kind: real.kind, model: real.model, ...(real.fallback ? { fallbackModel: real.fallback.model } : {}) };
  return { kind: "none" };
}

export function resolveRuntime(courseId: string | null, message: string) {
  return scriptedRuntimeAllowed() ? scriptedRuntime(courseId, message) : modelRuntime();
}
