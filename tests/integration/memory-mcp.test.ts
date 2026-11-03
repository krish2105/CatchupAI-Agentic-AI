import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMemory, confirmedMemories, deleteMemory, listMemories, suggestMemory, updateMemory } from "@/lib/memory/service";
import { overview, searchNotes, studyPlan } from "@/lib/mcp/tools";
import { ownerForMcpToken, rotateMcpToken } from "@/lib/mcp/token";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const asAdmin = () => admin() as unknown as AdminSupabase;

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("mem-a"), signedInUser("mem-b")]);
  const course = (await a.db.from("courses").insert({ title: "Private Stats" }).select("id").single()).data!.id;
  await a.db.from("assignments").insert({ course_id: course, title: "Secret sheet", due_at: new Date(Date.now() + 3 * 86400_000).toISOString(), estimated_minutes: 60 });
});
afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("copilot memory", () => {
  it("lets the student add, edit and delete their own memories", async () => {
    const m = await addMemory(asServer(a.db), "  I study best before 10am  ");
    expect(m).toMatchObject({ text: "I study best before 10am", status: "confirmed", source: "student" });
    expect((await updateMemory(asServer(a.db), m.id, { text: "I study best before 9am" })).text).toBe("I study best before 9am");
    expect(await confirmedMemories(asServer(a.db), a.id)).toEqual(["I study best before 9am"]);
    await deleteMemory(asServer(a.db), m.id);
    expect(await listMemories(asServer(a.db))).toEqual([]);
  });

  it("keeps copilot suggestions out of use until the student confirms them", async () => {
    expect(await suggestMemory(asAdmin(), a.id, "Prefers 25-minute sessions")).toBe("saved");
    expect(await suggestMemory(asAdmin(), a.id, "prefers 25-minute sessions")).toBe("duplicate");
    expect(await confirmedMemories(asAdmin(), a.id)).toEqual([]);
    const [pending] = await listMemories(asServer(a.db));
    expect(pending).toMatchObject({ status: "suggested", source: "copilot" });
    await updateMemory(asServer(a.db), pending.id, { confirm: true });
    expect(await confirmedMemories(asAdmin(), a.id)).toEqual(["Prefers 25-minute sessions"]);
  });

  it("is private, and students can't forge copilot suggestions or another owner", async () => {
    const [mine] = await listMemories(asServer(a.db));
    expect(await listMemories(asServer(b.db))).toEqual([]);
    await expect(updateMemory(asServer(b.db), mine.id, { text: "hijacked" })).rejects.toMatchObject({ status: 404 });
    await expect(deleteMemory(asServer(b.db), mine.id)).rejects.toMatchObject({ status: 404 });
    expect((await b.db.from("copilot_memories").insert({ text: "x".repeat(5), source: "copilot" } as never)).error?.code).toBe("42501");
    expect((await b.db.from("copilot_memories").insert({ text: "x".repeat(5), owner_id: a.id } as never)).error?.code).toBe("42501");
    expect((await b.db.from("copilot_memories").update({ source: "copilot" } as never).eq("id", mine.id)).error?.code).toBe("42501");
  });

  it("caps each student at 40 memories", async () => {
    await admin().from("copilot_memories").insert(Array.from({ length: 39 }, (_, i) => ({ owner_id: b.id, text: `Habit number ${i}` })));
    await addMemory(asServer(b.db), "The fortieth habit");
    await expect(addMemory(asServer(b.db), "One too many")).rejects.toMatchObject({ status: 400, code: "memory_limit" });
    expect(await suggestMemory(asAdmin(), b.id, "Another suggestion")).toBe("full");
  });
});

describe("personal MCP token", () => {
  it("resolves only the current token to its owner; rotation kills the old one", async () => {
    const first = await rotateMcpToken(asAdmin(), a.id);
    expect(first).toMatch(/^cu_mcp_[\w-]{43}$/);
    expect(await ownerForMcpToken(asAdmin(), first)).toBe(a.id);
    const second = await rotateMcpToken(asAdmin(), a.id);
    expect(await ownerForMcpToken(asAdmin(), first)).toBeNull();
    expect(await ownerForMcpToken(asAdmin(), second)).toBe(a.id);
    expect(await ownerForMcpToken(asAdmin(), "cu_mcp_" + "A".repeat(43))).toBeNull();
    expect(await ownerForMcpToken(asAdmin(), "not-a-token")).toBeNull();
    const { data } = await a.db.from("mcp_tokens").select("created_at, last_used_at").single();
    expect(data?.last_used_at).not.toBeNull();
    expect((await a.db.from("mcp_tokens").select("token_hash")).error?.code).toBe("42501");
    expect((await b.db.from("mcp_tokens").select("created_at")).data).toEqual([]);
  });

  it("serves only the token owner's data", async () => {
    const now = Date.now();
    expect((await overview(asAdmin(), a.id, now)).openAssignments.map((x) => x.title)).toEqual(["Secret sheet"]);
    const forB = await overview(asAdmin(), b.id, now);
    expect(forB.courses).toEqual([]);
    expect(forB.openAssignments).toEqual([]);
    expect((await studyPlan(asAdmin(), b.id, now, 7)).hasActivePlan).toBe(false);
    expect(await searchNotes(asAdmin(), b.id, "secret sheet")).toEqual([]);
    expect(await searchNotes(asAdmin(), a.id, "&&& !!")).toEqual([]);
  });
});
