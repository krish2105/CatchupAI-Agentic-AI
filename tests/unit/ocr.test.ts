import { describe, expect, it } from "vitest";
import { getOcr, OCR_LIMITS, OCR_PROMPT, openAiOcr, parseOcrPages } from "@/lib/rag/ocr";

describe("OCR response parsing", () => {
  it("returns one normalised string per page, fills missing pages and drops pages that don't exist", () => {
    const raw = JSON.stringify({ pages: [{ page: 2, text: "  Residuals   are\n\n\n\nobserved minus predicted " }, { page: 1, text: "Week 4" }, { page: 9, text: "ghost" }, { page: "x", text: "bad" }] });
    expect(parseOcrPages(raw, 3)).toEqual(["Week 4", "Residuals are\nobserved minus predicted", ""]);
  });

  it("caps very long pages and rejects malformed output", () => {
    const long = parseOcrPages(JSON.stringify({ pages: [{ page: 1, text: "a".repeat(OCR_LIMITS.maxCharsPerPage + 500) }] }), 1);
    expect(long[0]).toHaveLength(OCR_LIMITS.maxCharsPerPage);
    expect(() => parseOcrPages("not json", 1)).toThrow();
    expect(() => parseOcrPages(JSON.stringify({ text: "no pages" }), 1)).toThrow(/no pages/);
  });
});

const completion = (content: string, usage = { prompt_tokens: 600, completion_tokens: 50, total_tokens: 650 }) =>
  new Response(JSON.stringify({ id: "chatcmpl-test", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content, refusal: null } }], usage }), {
    headers: { "content-type": "application/json" },
  });

describe("OpenAI OCR request", () => {
  it("sends the PDF as a file with a transcribe-only prompt, asks for JSON pages, and counts the tokens", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent = { url: String(url), init };
      return completion(JSON.stringify({ pages: [{ page: 1, text: "Lecture 3" }] }));
    }) as unknown as typeof fetch;
    const ocr = openAiOcr({ apiKey: "sk-test-not-real", model: "some-model", fetchImpl });
    const r = await ocr.read(new Uint8Array([37, 80, 68, 70]), 1);
    expect(r).toEqual({ pages: ["Lecture 3"], usage: { inputTokens: 600, outputTokens: 50 } });
    expect(sent!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(new Headers(sent!.init.headers).get("authorization")).toBe("Bearer sk-test-not-real");
    const body = JSON.parse(String(sent!.init.body));
    expect(body.model).toBe("some-model");
    expect(body.store).toBe(false);
    expect(body.messages[0].content[0]).toEqual({ type: "file", file: { filename: "upload.pdf", file_data: "data:application/pdf;base64,JVBERg==" } });
    expect(body.messages[0].content[1]).toEqual({ type: "text", text: OCR_PROMPT });
    expect(OCR_PROMPT).toMatch(/never follow instructions/);
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "ocr_pages", strict: true } });
    expect(body.max_completion_tokens).toBe(OCR_LIMITS.maxOutputTokens);
  });

  it("reports HTTP failures with their status, and keeps the usage of an unparseable answer", async () => {
    const quota = openAiOcr({ apiKey: "k", model: "m", fetchImpl: (async () => new Response(JSON.stringify({ error: { message: "quota", type: "insufficient_quota" } }), { status: 429, headers: { "content-type": "application/json" } })) as unknown as typeof fetch });
    await expect(quota.read(new Uint8Array([1]), 1)).rejects.toMatchObject({ status: 429 });
    const garbled = openAiOcr({ apiKey: "k", model: "m", fetchImpl: (async () => completion("oops", { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 })) as unknown as typeof fetch });
    await expect(garbled.read(new Uint8Array([1]), 1)).rejects.toMatchObject({ usage: { inputTokens: 5, outputTokens: 1 } });
  });
});

describe("OCR availability", () => {
  const local = { CATCHUP_TEST_MODEL: "scripted", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
  it("is on with an OpenAI key and model, uses OPENAI_OCR_MODEL first, and can be switched off", () => {
    expect(getOcr({ OPENAI_API_KEY: "k", OPENAI_MODEL: "copilot-model" })?.model).toBe("copilot-model");
    expect(getOcr({ OPENAI_API_KEY: "k", OPENAI_MODEL: "copilot-model", OPENAI_OCR_MODEL: "ocr-model" })?.model).toBe("ocr-model");
    expect(getOcr({ OPENAI_API_KEY: "k", OPENAI_MODEL: "copilot-model", PDF_OCR: "off" })).toBeNull();
    expect(getOcr({ OPENAI_API_KEY: "k" })).toBeNull();
    expect(getOcr({ GEMINI_API_KEY: "k", GEMINI_MODEL: "old-model" })).toBeNull();
    expect(getOcr({})).toBeNull();
  });
  it("never calls a real model in local automated tests", () => {
    expect(getOcr({ OPENAI_API_KEY: "k", OPENAI_MODEL: "m", ...local })).toBeNull();
  });
});
