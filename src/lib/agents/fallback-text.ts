/** Plain-language reasons for a model fallback (agent_runs.fallback_reason). Safe for client components. */
export const FALLBACK_REASON_TEXT: Record<string, string> = {
  model_quota: "its daily quota was used up",
  model_busy: "it was at its rate limit",
  model_overloaded: "it was overloaded",
  provider_timeout: "it did not answer in time",
  attempt_timeout: "it did not answer in time",
};

export function fallbackNote(meta: { fallbackFrom: string | null; fallbackReason: string | null }) {
  if (!meta.fallbackFrom) return null;
  return `fallback: ${meta.fallbackFrom} was skipped because ${FALLBACK_REASON_TEXT[meta.fallbackReason ?? ""] ?? "it failed"}`;
}
