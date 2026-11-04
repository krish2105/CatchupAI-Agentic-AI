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
