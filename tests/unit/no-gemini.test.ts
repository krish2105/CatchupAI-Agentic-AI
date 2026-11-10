import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The app runs on OpenAI only (ADR-088). Gemini may appear in src/ only where it is history, not configuration:
 * a past incident on the status page, and the quality snapshot the build copies from recorded evaluation runs.
 */
const HISTORY_ONLY = new Set(["src/lib/status/incidents.ts", "src/lib/quality/snapshot.json"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name).split(sep).join("/");
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("OpenAI only", () => {
  it("has no Gemini code, settings or wording left in the app", () => {
    const left = files("src").filter((f) => !HISTORY_ONLY.has(f) && /gemini/i.test(readFileSync(f, "utf8")));
    expect(left).toEqual([]);
  });

  it("documents only OpenAI settings in .env.example", () => {
    expect(readFileSync(".env.example", "utf8")).not.toMatch(/gemini/i);
  });
});
