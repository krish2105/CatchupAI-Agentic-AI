/**
 * Gemini 3 models attach a "thought signature" to every tool call (`tool_calls[].extra_content`) and reject the next
 * request with 400 "Function call is missing a thought_signature" unless it is sent back. The Agents SDK's
 * chat-completions path doesn't keep that field, so this fetch wrapper remembers each signature from Google's
 * response and puts it back on the matching tool call in the following request. It also sets the thinking level
 * (`reasoning_effort`, default "minimal") because full thinking takes ~30 s per step on the free tier.
 * On the free tier Google also limits requests per minute: a 429/503 is retried after the delay Google asks for
 * (its `retryDelay`), within a total waiting budget, instead of failing the whole multi-step run.
 */
type ToolCall = { id?: string; function?: { name?: string; arguments?: string }; extra_content?: unknown };
type Message = { role?: string; tool_calls?: ToolCall[] };

const MAX_REMEMBERED = 2000;
const signatures = new Map<string, unknown>();

const keysFor = (call: ToolCall) => [call.id ? `id:${call.id}` : null, `fn:${call.function?.name ?? ""}:${call.function?.arguments ?? ""}`].filter((k): k is string => Boolean(k));

function remember(call: ToolCall) {
  if (!call.extra_content) return;
  for (const key of keysFor(call)) signatures.set(key, call.extra_content);
  while (signatures.size > MAX_REMEMBERED) signatures.delete(signatures.keys().next().value as string);
}

/** Adds remembered signatures and the thinking level to an outgoing chat-completions body. Exported for tests. */
export function patchRequestBody(body: Record<string, unknown>, reasoningEffort = process.env.GEMINI_REASONING_EFFORT || "minimal") {
  const messages = Array.isArray(body.messages) ? (body.messages as Message[]) : [];
  for (const message of messages) {
    if (message.role !== "assistant" || !message.tool_calls) continue;
    for (const call of message.tool_calls) {
      if (call.extra_content) continue;
      const found = keysFor(call).map((k) => signatures.get(k)).find(Boolean);
      if (found) call.extra_content = found;
    }
  }
  if (reasoningEffort !== "default" && body.reasoning_effort === undefined) body.reasoning_effort = reasoningEffort;
  return body;
}

/** Records the signatures from a chat-completions response body. Exported for tests. */
export function rememberResponse(json: { choices?: { message?: Message }[] }) {
  for (const choice of json.choices ?? []) for (const call of choice.message?.tool_calls ?? []) remember(call);
}

const RETRYABLE = new Set([429, 500, 503]);

/** Seconds Google asks us to wait (from `retryDelay: "23s"` in the error body), or a default. Exported for tests. */
export function retryDelaySeconds(bodyText: string, status: number) {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(bodyText);
  return match ? Math.ceil(Number(match[1])) : status === 429 ? 20 : 5;
}

export function geminiFetch(base: typeof fetch = fetch, opts: { maxAttempts?: number; maxWaitSeconds?: number; sleep?: (ms: number) => Promise<void> } = {}): typeof fetch {
  const maxAttempts = opts.maxAttempts ?? 4;
  const maxWait = opts.maxWaitSeconds ?? 90;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isChat = url.includes("/chat/completions");
    let nextInit = init;
    if (isChat && typeof init?.body === "string") {
      try {
        nextInit = { ...init, body: JSON.stringify(patchRequestBody(JSON.parse(init.body))) };
      } catch {
        nextInit = init;
      }
    }
    let response = await base(input, nextInit);
    let waited = 0;
    for (let attempt = 1; isChat && RETRYABLE.has(response.status) && attempt < maxAttempts; attempt++) {
      const body = await response.clone().text();
      // A daily quota (retry in hours) won't clear within a run: fail now instead of hanging.
      if (/PerDay/i.test(body)) break;
      const delay = retryDelaySeconds(body, response.status) + 1;
      if (delay > 40 || waited + delay > maxWait || nextInit?.signal?.aborted) break;
      await sleep(delay * 1000);
      waited += delay;
      response = await base(input, nextInit);
    }
    if (isChat && response.ok && (response.headers.get("content-type") ?? "").includes("application/json")) {
      try {
        rememberResponse(await response.clone().json());
      } catch {
        /* not JSON: nothing to remember */
      }
    }
    return response;
  };
}
