import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importAssignments, importBody } from "@/lib/import/service";
import type { ServerSupabase } from "@/lib/supabase/server";
import { deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; db: Db };
let a: User;
let b: User;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const due = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("lms-a"), signedInUser("lms-b")]);
  await a.db.from("courses").insert({ title: "Applied Statistics" });
  // Student B has a course with the same name: it must never receive A's import.
  await b.db.from("courses").insert({ title: "Applied Statistics" });
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("LMS import (batch)", () => {
  const items = [
    { courseTitle: "applied statistics", title: "Regression worksheet", dueAt: due(5), estimatedMinutes: 120, notes: "Imported from canvas.ics" },
    { courseTitle: "Chemistry 101", title: "Lab report", dueAt: due(7), estimatedMinutes: 120, notes: "Imported from canvas.ics" },
    { courseTitle: "Chemistry 101", title: "Mole quiz", dueAt: due(9), estimatedMinutes: 90, notes: "" },
  ];

  it("matches existing courses by name (any case), creates missing ones once, and adds the assignments", async () => {
    const r = await importAssignments(asServer(a.db), importBody.parse({ items }));
    expect(r).toEqual({ created: 3, createdCourses: ["Chemistry 101"], skippedDuplicates: 0 });
    const { data: courses } = await a.db.from("courses").select("id, title").order("title");
    expect(courses!.map((c) => c.title)).toEqual(["Applied Statistics", "Chemistry 101"]);
    const { data: rows } = await a.db.from("assignments").select("title, course_id, estimated_minutes, notes").order("title");
    expect(rows!.map((x) => x.title)).toEqual(["Lab report", "Mole quiz", "Regression worksheet"]);
    expect(rows!.find((x) => x.title === "Regression worksheet")!.course_id).toBe(courses!.find((c) => c.title === "Applied Statistics")!.id);
  });

  it("skips items already imported (same course, title and due time)", async () => {
    const r = await importAssignments(asServer(a.db), importBody.parse({ items: [...items, { ...items[0], dueAt: due(6) }] }));
    expect(r).toEqual({ created: 1, createdCourses: [], skippedDuplicates: 3 });
  });

  it("never touches another student's course or assignments", async () => {
    const { count } = await b.db.from("assignments").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
    const { data: bCourses } = await b.db.from("courses").select("title");
    expect(bCourses!.map((c) => c.title)).toEqual(["Applied Statistics"]);
  });

  it("validates the batch: 1 to 200 items, strict fields, real instants", () => {
    expect(importBody.safeParse({ items: [] }).success).toBe(false);
    expect(importBody.safeParse({ items: Array.from({ length: 201 }, () => items[0]) }).success).toBe(false);
    expect(importBody.safeParse({ items: [{ ...items[0], dueAt: "next week" }] }).success).toBe(false);
    expect(importBody.safeParse({ items: [{ ...items[0], ownerId: b.id }] }).success).toBe(false);
  });
});
