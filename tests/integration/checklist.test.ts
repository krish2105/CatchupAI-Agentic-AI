import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listChecklists, replaceChecklist, updateChecklistItem } from "@/lib/db/checklist";
import type { ServerSupabase } from "@/lib/supabase/server";
import { deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let assignmentA: string;
let docA: string;

const asServer = (db: Db) => db as unknown as ServerSupabase;
const ITEMS = [
  { kind: "criterion" as const, text: "Analysis and interpretation", weight: 40, page: 2 },
  { kind: "requirement" as const, text: "Use APA 7 referencing", weight: null, page: 1 },
];

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("checklist-a"), signedInUser("checklist-b")]);
  const course = (await a.db.from("courses").insert({ title: "Statistics" }).select("id").single()).data!.id;
  assignmentA = (await a.db.from("assignments").insert({ course_id: course, title: "Report", due_at: new Date(Date.now() + 5 * 86400_000).toISOString(), estimated_minutes: 120 }).select("id").single()).data!.id;
  docA = (await a.db.from("documents").insert({ course_id: course, filename: "brief.pdf", size_bytes: 1000 }).select("id").single()).data!.id;
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("assignment checklists", () => {
  it("saves confirmed items with page links, and a second save replaces the first", async () => {
    const first = await replaceChecklist(asServer(a.db), assignmentA, docA, ITEMS);
    expect(first.map((i) => [i.kind, i.weight, i.documentId, i.page])).toEqual([["criterion", 40, docA, 2], ["requirement", null, docA, 1]]);
    const second = await replaceChecklist(asServer(a.db), assignmentA, docA, [ITEMS[0]]);
    const all = await listChecklists(asServer(a.db), [assignmentA]);
    expect(all[assignmentA].map((i) => i.id)).toEqual(second.map((i) => i.id));
  });

  it("lets the owner tick items off but not rewrite their kind or weight", async () => {
    const [item] = (await listChecklists(asServer(a.db), [assignmentA]))[assignmentA];
    expect((await updateChecklistItem(asServer(a.db), item.id, { done: true })).done).toBe(true);
    const forged = await a.db.from("assignment_checklist_items").update({ weight: 100 }).eq("id", item.id);
    expect(forged.error?.code).toBe("42501");
  });

  it("keeps other students out: no reading, no attaching to someone else's assignment or brief", async () => {
    expect(await listChecklists(asServer(b.db), [assignmentA])).toEqual({});
    await expect(replaceChecklist(asServer(b.db), assignmentA, null, ITEMS)).rejects.toMatchObject({ status: 404 });
    // Direct API insert pointing at A's assignment fails the composite (assignment, owner) key.
    const direct = await b.db.from("assignment_checklist_items").insert({ assignment_id: assignmentA, kind: "requirement", text: "Injected", position: 0 });
    expect(direct.error).not.toBeNull();
    const bCourse = (await b.db.from("courses").insert({ title: "B course" }).select("id").single()).data!.id;
    const bAssignment = (await b.db.from("assignments").insert({ course_id: bCourse, title: "B work", due_at: new Date(Date.now() + 86400_000).toISOString(), estimated_minutes: 60 }).select("id").single()).data!.id;
    await expect(replaceChecklist(asServer(b.db), bAssignment, docA, ITEMS)).rejects.toMatchObject({ status: 404 });
    const { data } = await b.db.from("assignment_checklist_items").select("id");
    expect(data).toEqual([]);
  });
});
