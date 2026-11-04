import { beforeEach, describe, expect, it } from "vitest";
import { cachedRead, clearToolCache, invalidateStudent, TOOL_CACHE, toolCacheSize } from "@/lib/agents/tool-cache";
import { route } from "@/lib/http/errors";
import { noteAuthenticatedStudent } from "@/lib/http/request-scope";

beforeEach(() => clearToolCache());

function counter() {
  let n = 0;
  return { load: async () => ++n, get calls() { return n; } };
}

describe("tool-result cache", () => {
  it("serves a repeat read for the same student, tool and arguments", async () => {
    const c = counter();
    expect(await cachedRead("u1", "list_assignments", { courseId: null }, c.load)).toEqual({ value: 1, hit: false });
    expect(await cachedRead("u1", "list_assignments", { courseId: null }, c.load)).toEqual({ value: 1, hit: true });
    expect(c.calls).toBe(1);
  });

  it("never shares entries between students, tools or different arguments", async () => {
    const c = counter();
    await cachedRead("u1", "list_assignments", { courseId: null }, c.load);
    expect((await cachedRead("u2", "list_assignments", { courseId: null }, c.load)).hit).toBe(false);
    expect((await cachedRead("u1", "get_study_preferences", { courseId: null }, c.load)).hit).toBe(false);
    expect((await cachedRead("u1", "list_assignments", { courseId: "x" }, c.load)).hit).toBe(false);
    expect(c.calls).toBe(4);
  });

  it("expires entries after the TTL", async () => {
    let t = 1_000;
    const c = counter();
    await cachedRead("u1", "t", {}, c.load, () => t);
    t += TOOL_CACHE.ttlMs - 1;
    expect((await cachedRead("u1", "t", {}, c.load, () => t)).hit).toBe(true);
    t += 2;
    expect((await cachedRead("u1", "t", {}, c.load, () => t)).hit).toBe(false);
  });

  it("is cleared for that student only on a write", async () => {
    const c = counter();
    await cachedRead("u1", "t", {}, c.load);
    await cachedRead("u2", "t", {}, c.load);
    invalidateStudent("u1");
    expect((await cachedRead("u1", "t", {}, c.load)).hit).toBe(false);
    expect((await cachedRead("u2", "t", {}, c.load)).hit).toBe(true);
  });

  it("drops a read that was still loading when a write happened", async () => {
    let release!: () => void;
    const slow = () => new Promise<string>((r) => (release = () => r("stale")));
    const pending = cachedRead("u1", "t", {}, slow);
    invalidateStudent("u1");
    release();
    expect(await pending).toEqual({ value: "stale", hit: false }); // the caller that asked still gets its answer
    expect((await cachedRead("u1", "t", {}, async () => "fresh")).value).toBe("fresh");
  });

  it("stays bounded in size", async () => {
    for (let i = 0; i < TOOL_CACHE.maxEntries + 50; i++) await cachedRead("u1", "t", { i }, async () => i);
    expect(toolCacheSize()).toBe(TOOL_CACHE.maxEntries);
  });
});

describe("write requests clear the student's cache", () => {
  const handler = route(async (req: Request) => {
    noteAuthenticatedStudent("u1");
    void req;
    return new Response("ok");
  });

  it("a POST/PATCH/DELETE by the student invalidates their entries", async () => {
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const c = counter();
      await cachedRead("u1", "t", {}, c.load);
      await handler(new Request("http://localhost/api/assignments", { method }));
      expect((await cachedRead("u1", "t", {}, c.load)).hit).toBe(false);
    }
  });

  it("a GET leaves the cache alone", async () => {
    const c = counter();
    await cachedRead("u1", "t", {}, c.load);
    await handler(new Request("http://localhost/api/assignments", { method: "GET" }));
    expect((await cachedRead("u1", "t", {}, c.load)).hit).toBe(true);
  });

  it("a write that fails still clears the cache (it may have partly applied)", async () => {
    const failing = route(async (req: Request) => {
      noteAuthenticatedStudent("u1");
      void req;
      throw new Error("boom");
    });
    const c = counter();
    await cachedRead("u1", "t", {}, c.load);
    expect((await failing(new Request("http://localhost/api/x", { method: "POST" }))).status).toBe(500);
    expect((await cachedRead("u1", "t", {}, c.load)).hit).toBe(false);
  });
});
