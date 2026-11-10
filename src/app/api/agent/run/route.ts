import { z } from "zod";
import { AGENT_LIMITS, runRecoveryAgent } from "@/lib/agents/recovery-agent";
import { resolveRuntime } from "@/lib/agents/runtime";
import { resolveThread } from "@/lib/agents/threads";
import { assertAiAvailable } from "@/lib/ai/guard";
import { agentDailyLimit } from "@/lib/billing/plan-limits";
import { recordAppError } from "@/lib/observability/app-errors";
import { logEvent } from "@/lib/observability/log";
import { requireApiUser } from "@/lib/auth/session";
import { getCourse } from "@/lib/db/courses";
import { getAgentRun } from "@/lib/db/agent-runs";
import { ApiError, readJson, route } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { getEmbedder } from "@/lib/rag/embed";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

export const maxDuration = 200;

// threadId continues a conversation (the student's own); without it a new conversation starts.
const body = z.object({ message: z.string().trim().min(3).max(AGENT_LIMITS.maxMessageChars), courseId: uuid.nullable(), threadId: uuid.nullable().optional(), mode: z.enum(["answer", "guide"]).optional() }).strict();

/**
 * Runs the LearningRecoveryAgent and streams real tool events (Server-Sent Events) as they execute.
 * Events: run {runId} · tool {event} · answer {reset | fact (already citation-checked) | text (partial suggestions)}
 * · final {run} · error {code,message}. The final run is the persisted, verified answer and replaces any live text.
 */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  const input = body.parse(await readJson(request, 8 * 1024));
  if (input.courseId) await getCourse(supabase, input.courseId);
  const runtime = resolveRuntime(input.courseId, input.message);
  if (!runtime) throw new ApiError(503, "ai_not_configured", "The AI runtime isn't configured on this server (OPENAI_API_KEY and OPENAI_MODEL).");
  // Kill switch, daily token budget and one-run-at-a-time are checked before any quota is spent.
  await assertAiAvailable(adminClient(), user.id);
  // Members of a Class-plan organisation get a higher daily copilot limit.
  await enforceRateLimit(supabase, "agent", user, { limit: await agentDailyLimit(supabase, user.id) });
  // After the limits, so a refused request never creates a conversation.
  const threadId = await resolveThread(supabase, adminClient(), user.id, input.threadId ?? null, input.message);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* client went away */
        }
      };
      try {
        const outcome = await runRecoveryAgent({
          supabase,
          admin: adminClient(),
          userId: user.id,
          courseId: input.courseId,
          message: input.message,
          threadId,
          mode: input.mode ?? "answer",
          runtime,
          embedder: getEmbedder(),
          now: Date.now(),
          signal: request.signal,
          onRunCreated: (runId) => send("run", { runId }),
          onEvent: (event) => send("tool", event),
          onAnswer: (event) => send("answer", event),
        });
        send("final", { run: await getAgentRun(supabase, outcome.runId), removedUnsupportedFacts: outcome.removedUnsupportedFacts });
      } catch (error) {
        logEvent("error", "agent.stream_error", { error: error instanceof Error ? error.name : "unknown" });
        await recordAppError({ source: "agent", path: "/api/agent/run", error });
        send("error", { code: "internal", message: "The copilot failed. Nothing was changed." });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" } });
});
