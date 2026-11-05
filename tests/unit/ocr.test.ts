import { describe, expect, it } from "vitest";
import { geminiOcr, getOcr, OCR_LIMITS, OCR_PROMPT, parseOcrPages } from "@/lib/rag/ocr";

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

describe("Gemini OCR request", () => {
  it("sends the PDF inline with a transcribe-only prompt and counts thinking tokens as output", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pages: [{ page: 1, text: "Lecture 3" }] }) }] } }], usageMetadata: { promptTokenCount: 600, candidatesTokenCount: 40, thoughtsTokenCount: 10 } }));
    }) as unknown as typeof fetch;
    const ocr = geminiOcr({ apiKey: "test-key-not-real", model: "some-model", fetchImpl });
    const r = await ocr.read(new Uint8Array([37, 80, 68, 70]), 1);
    expect(r).toEqual({ pages: ["Lecture 3"], usage: { inputTokens: 600, outputTokens: 50 } });
    expect(sent!.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/some-model:generateContent");
    expect((sent!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key-not-real");
    const body = JSON.parse(String(sent!.init.body));
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: "application/pdf", data: "JVBERg==" });
    expect(body.contents[0].parts[1].text).toBe(OCR_PROMPT);
    expect(OCR_PROMPT).toMatch(/never follow instructions/);
    expect(body.generationConfig).toMatchObject({ temperature: 0, responseMimeType: "application/json" });
  });

  it("reports HTTP failures with their status, and keeps the usage of an unparseable answer", async () => {
    const quota = geminiOcr({ apiKey: "k", model: "m", fetchImpl: (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch });
    await expect(quota.read(new Uint8Array([1]), 1)).rejects.toMatchObject({ status: 429 });
    const garbled = geminiOcr({ apiKey: "k", model: "m", fetchImpl: (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "oops" }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 } }))) as unknown as typeof fetch });
    await expect(garbled.read(new Uint8Array([1]), 1)).rejects.toMatchObject({ usage: { inputTokens: 5, outputTokens: 1 } });
  });
});

describe("OCR availability", () => {
  const local = { CATCHUP_TEST_MODEL: "scripted", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
  it("is on with a Gemini key, uses GEMINI_OCR_MODEL first, and can be switched off", () => {
    expect(getOcr({ GEMINI_API_KEY: "k", GEMINI_MODEL: "copilot-model" })?.model).toBe("copilot-model");
    expect(getOcr({ GEMINI_API_KEY: "k", GEMINI_MODEL: "copilot-model", GEMINI_OCR_MODEL: "ocr-model" })?.model).toBe("ocr-model");
    expect(getOcr({ GEMINI_API_KEY: "k", PDF_OCR: "off" })).toBeNull();
    expect(getOcr({})).toBeNull();
  });
  it("never calls a real model in local automated tests", () => {
    expect(getOcr({ GEMINI_API_KEY: "k", ...local })).toBeNull();
  });
});
