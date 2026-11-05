import { describe, expect, it } from "vitest";
import { geminiFetch, patchRequestBody, rememberResponse, retryDelaySeconds } from "@/lib/agents/gemini-fetch";

const signature = { google: { thought_signature: "sig-123" } };

describe("Gemini thought signatures", () => {
  it("puts a remembered signature back on the matching tool call and sets the thinking level", () => {
    rememberResponse({ choices: [{ message: { role: "assistant", tool_calls: [{ id: "call_a", function: { name: "list_assignments", arguments: "{}" }, extra_content: signature }] } }] });
    const body = patchRequestBody({ messages: [{ role: "user" }, { role: "assistant", tool_calls: [{ id: "call_a", function: { name: "list_assignments", arguments: "{}" } }] }] });
    const call = (body.messages as { tool_calls?: { extra_content?: unknown }[] }[])[1].tool_calls![0];
    expect(call.extra_content).toEqual(signature);
    expect(body.reasoning_effort).toBe("minimal");
  });

  it("matches by function name and arguments when ids differ, and leaves other calls alone", () => {
    rememberResponse({ choices: [{ message: { tool_calls: [{ function: { name: "search_course_material", arguments: '{"q":"x"}' }, extra_content: signature }] } }] });
    const body = patchRequestBody({ messages: [{ role: "assistant", tool_calls: [{ id: "other", function: { name: "search_course_material", arguments: '{"q":"x"}' } }, { id: "new", function: { name: "get_learning_progress", arguments: "{}" } }] }] }, "default");
    const calls = (body.messages as { tool_calls: { extra_content?: unknown }[] }[])[0].tool_calls;
    expect(calls[0].extra_content).toEqual(signature);
    expect(calls[1].extra_content).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("records signatures from real responses as they pass through fetch", async () => {
    const fake: typeof fetch = async () => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: "call_z", function: { name: "f", arguments: "{}" }, extra_content: signature }] } }] }), { headers: { "content-type": "application/json" } });
    let sent = "";
    const capture: typeof fetch = async (_input, init) => { sent = String(init?.body); return new Response("{}", { headers: { "content-type": "application/json" } }); };
    await geminiFetch(fake)("https://x/v1beta/openai/chat/completions", { method: "POST", body: "{}" });
    await geminiFetch(capture)("https://x/v1beta/openai/chat/completions", { method: "POST", body: JSON.stringify({ messages: [{ role: "assistant", tool_calls: [{ id: "call_z", function: { name: "f", arguments: "{}" } }] }] }) });
    expect(JSON.parse(sent).messages[0].tool_calls[0].extra_content).toEqual(signature);
  });
});

describe("Gemini rate limits", () => {
  it("waits the delay Google asks for and retries a 429, then returns the success", async () => {
    let calls = 0;
    const waits: number[] = [];
    const flaky: typeof fetch = async () => {
      calls++;
      return calls === 1
        ? new Response(JSON.stringify({ error: { code: 429, details: [{ retryDelay: "7s" }] } }), { status: 429, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify({ choices: [] }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const res = await geminiFetch(flaky, { sleep: async (ms) => { waits.push(ms); } })("https://x/v1beta/openai/chat/completions", { method: "POST", body: "{}" });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    expect(waits).toEqual([8000]);
  });

  it("gives up within the waiting budget and returns the last error", async () => {
    let calls = 0;
    const busy: typeof fetch = async () => { calls++; return new Response("{}", { status: 503 }); };
    const res = await geminiFetch(busy, { sleep: async () => {}, maxAttempts: 3 })("https://x/v1beta/openai/chat/completions", { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
    expect(calls).toBe(3);
    expect(retryDelaySeconds('{"retryDelay": "34s"}', 429)).toBe(34);
  });
});

describe("Gemini daily quota", () => {
  it("does not wait when the daily quota is used up", async () => {
    let calls = 0;
    const waits: number[] = [];
    const daily: typeof fetch = async () => { calls++; return new Response(JSON.stringify({ error: { code: 429, details: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }, { retryDelay: "28489s" }] } }), { status: 429 }); };
    const res = await geminiFetch(daily, { sleep: async (ms) => { waits.push(ms); } })("https://x/v1beta/openai/chat/completions", { method: "POST", body: "{}" });
    expect(res.status).toBe(429);
    expect(calls).toBe(1);
    expect(waits).toEqual([]);
  });
});

describe("Gemini thought signatures on streamed responses", () => {
  it("collects a tool call split across SSE chunks and remembers its signature", async () => {
    const chunks = [
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_s", function: { name: "list_assignments", arguments: '{"courseId"' }, extra_content: signature }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':null}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
    ];
    const sse = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
    const streamed: typeof fetch = async () =>
      new Response(new Blob([sse]).stream(), { headers: { "content-type": "text/event-stream" } });
    const res = await geminiFetch(streamed)("https://x/v1beta/openai/chat/completions", { method: "POST", body: JSON.stringify({ stream: true }) });
    // The body passes through unchanged for the SDK to read.
    expect(await res.text()).toBe(sse);

    let sent = "";
    const capture: typeof fetch = async (_input, init) => { sent = String(init?.body); return new Response("{}", { headers: { "content-type": "application/json" } }); };
    // Matched by function name + the reassembled arguments even if the SDK sends a different id.
    await geminiFetch(capture)("https://x/v1beta/openai/chat/completions", { method: "POST", body: JSON.stringify({ messages: [{ role: "assistant", tool_calls: [{ id: "other", function: { name: "list_assignments", arguments: '{"courseId":null}' } }] }] }) });
    expect(JSON.parse(sent).messages[0].tool_calls[0].extra_content).toEqual(signature);
  });
});

describe("Gemini thinking level per model", () => {
  const chat = "https://x/v1beta/openai/chat/completions";
  const minimalRejected = () => new Response(JSON.stringify([{ error: { code: 400, message: "Thinking level MINIMAL is not supported for this model. Please retry with other thinking level.", status: "INVALID_ARGUMENT" } }]), { status: 400, headers: { "content-type": "application/json" } });
  const ok = () => new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "{}" } }] }), { headers: { "content-type": "application/json" } });

  it("retries once with 'low' when a model rejects 'minimal', and asks for 'low' first next time", async () => {
    const sent: unknown[] = [];
    const model: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      sent.push(body.reasoning_effort);
      return body.reasoning_effort === "minimal" ? minimalRejected() : ok();
    };
    const f = geminiFetch(model);
    expect((await f(chat, { method: "POST", body: JSON.stringify({ model: "newer-flash", messages: [] }) })).status).toBe(200);
    expect((await f(chat, { method: "POST", body: JSON.stringify({ model: "newer-flash", messages: [] }) })).status).toBe(200);
    expect(sent).toEqual(["minimal", "low", "low"]);
    expect(patchRequestBody({ model: "another-model", messages: [] }).reasoning_effort).toBe("minimal");
  });

  it("doesn't retry other 400s or a thinking level the deployment chose", async () => {
    let calls = 0;
    const bad: typeof fetch = async () => { calls++; return new Response(JSON.stringify({ error: { message: "Invalid JSON payload" } }), { status: 400 }); };
    expect((await geminiFetch(bad)(chat, { method: "POST", body: JSON.stringify({ model: "m", messages: [] }) })).status).toBe(400);
    expect(calls).toBe(1);
    calls = 0;
    const rejectsAll: typeof fetch = async () => { calls++; return minimalRejected(); };
    expect((await geminiFetch(rejectsAll)(chat, { method: "POST", body: JSON.stringify({ model: "m2", messages: [], reasoning_effort: "high" }) })).status).toBe(400);
    expect(calls).toBe(1);
  });
});

describe("Gemini streamed tool calls as Google sends them", () => {
  const chat = "https://x/v1beta/openai/chat/completions";
  const capture = () => {
    const sent: { body: string } = { body: "" };
    const f: typeof fetch = async (_input, init) => { sent.body = String(init?.body); return new Response("{}", { headers: { "content-type": "application/json" } }); };
    return { f, sent };
  };

  it("remembers each signature as soon as its chunk arrives, before the stream is closed", async () => {
    // Shape captured from gemini-3.1-flash-lite on 2026-11-05: whole call in one chunk, no `index`.
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { role: "assistant", tool_calls: [{ extra_content: { google: { thought_signature: "sig-early" } }, function: { arguments: "{}", name: "list_assignments" }, id: "call_early", type: "function" }] }, index: 0 }] })}\n\n`;
    let push!: (s: string) => void;
    const body = new ReadableStream<Uint8Array>({ start(c) { push = (s) => c.enqueue(new TextEncoder().encode(s)); } });
    const streamed: typeof fetch = async () => new Response(body, { headers: { "content-type": "text/event-stream" } });
    const res = await geminiFetch(streamed)(chat, { method: "POST", body: JSON.stringify({ stream: true }) });
    const reader = res.body!.getReader();
    push(sse);
    await reader.read(); // the SDK has the tool call; the stream is still open
    const { f, sent } = capture();
    await geminiFetch(f)(chat, { method: "POST", body: JSON.stringify({ messages: [{ role: "assistant", tool_calls: [{ id: "call_early", function: { name: "list_assignments", arguments: "{}" } }] }] }) });
    expect(JSON.parse(sent.body).messages[0].tool_calls[0].extra_content).toEqual({ google: { thought_signature: "sig-early" } });
  });

  it("keeps parallel calls without an `index` apart", async () => {
    const calls = [
      { extra_content: { google: { thought_signature: "sig-p1" } }, function: { arguments: '{"a":1}', name: "get_study_preferences" }, id: "call_p1", type: "function" },
      { function: { arguments: '{"b":2}', name: "list_assignments" }, id: "call_p2", type: "function" },
    ];
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { role: "assistant", tool_calls: calls }, index: 0 }] })}\n\ndata: [DONE]\n\n`;
    const streamed: typeof fetch = async () => new Response(new Blob([sse]).stream(), { headers: { "content-type": "text/event-stream" } });
    await (await geminiFetch(streamed)(chat, { method: "POST", body: JSON.stringify({ stream: true }) })).text();
    const { f, sent } = capture();
    // The SDK sends both calls back; ids may be rewritten, so matching by name + arguments must work too.
    await geminiFetch(f)(chat, { method: "POST", body: JSON.stringify({ messages: [{ role: "assistant", tool_calls: [{ id: "x1", function: { name: "get_study_preferences", arguments: '{"a":1}' } }, { id: "call_p2", function: { name: "list_assignments", arguments: '{"b":2}' } }] }] }) });
    const back = JSON.parse(sent.body).messages[0].tool_calls;
    expect(back[0].extra_content).toEqual({ google: { thought_signature: "sig-p1" } });
    expect(back[1].extra_content).toBeUndefined();
  });
});
