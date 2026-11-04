import { Usage, type Model, type ModelProvider, type ModelRequest, type ModelResponse } from "@openai/agents";

/**
 * Deterministic stand-in for an LLM, used ONLY by automated tests (and by the E2E server when explicitly
 * enabled outside production). It speaks the real Agents SDK protocol, so the SDK run loop, tool execution,
 * database access and persistence all run for real; only the language model is replaced.
 */
export type ScriptStep =
  | { call: string; args: Record<string, unknown> | ((ctx: ScriptView) => Record<string, unknown>) }
  | { answer: unknown | ((ctx: ScriptView) => unknown) }
  | { fail: string; status?: number };

export type ScriptView = { turn: number; lastToolOutput: string; toolOutputs: string[]; input: string };

function view(request: ModelRequest, turn: number): ScriptView {
  const items = Array.isArray(request.input) ? request.input : [];
  const outputs = items
    .filter((i) => (i as { type?: string }).type === "function_call_result")
    .map((i) => {
      const o = (i as { output?: unknown }).output;
      if (typeof o === "string") return o;
      if (o && typeof o === "object" && "text" in (o as object)) return String((o as { text: unknown }).text);
      return JSON.stringify(o);
    });
  const firstUser = items.find((i) => (i as { role?: string }).role === "user") as { content?: unknown } | undefined;
  const input = typeof request.input === "string" ? request.input : typeof firstUser?.content === "string" ? firstUser.content : JSON.stringify(firstUser?.content ?? "");
  return { turn, lastToolOutput: outputs.at(-1) ?? "", toolOutputs: outputs, input };
}

export class ScriptedModel implements Model {
  turn = 0;
  requests: ModelRequest[] = [];
  constructor(private readonly steps: ScriptStep[], private readonly loopLast = false) {}

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push(request);
    const index = this.loopLast ? Math.min(this.turn, this.steps.length - 1) : this.turn;
    const step = this.steps[index];
    const ctx = view(request, this.turn);
    this.turn++;
    if (!step) throw new Error("Script exhausted");
    // `status` mimics an HTTP error from the provider (429 quota, 503 overload) so fallback paths can be tested.
    if ("fail" in step) throw Object.assign(new Error(step.fail), { code: "model_error", ...(step.status ? { status: step.status } : {}) });
    // No language model runs, so no tokens are used (the UI then shows no token count).
    const usage = new Usage({ requests: 1, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    if ("call" in step) {
      const args = typeof step.args === "function" ? step.args(ctx) : step.args;
      return {
        usage,
        output: [{ type: "function_call", callId: `call_${this.turn}`, name: step.call, arguments: JSON.stringify(args), status: "completed" }],
      };
    }
    const answer = typeof step.answer === "function" ? (step.answer as (c: ScriptView) => unknown)(ctx) : step.answer;
    return {
      usage,
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(answer) }] }],
    };
  }

  async *getStreamedResponse(): AsyncIterable<never> {
    throw new Error("ScriptedModel does not stream");
  }
}

export class ScriptedProvider implements ModelProvider {
  constructor(public model: ScriptedModel) {}
  getModel() {
    return this.model;
  }
}
