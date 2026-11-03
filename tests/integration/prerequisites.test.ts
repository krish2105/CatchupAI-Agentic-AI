import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addPrerequisite, listPrerequisites } from "@/lib/db/prerequisites";
import type { ServerSupabase } from "@/lib/supabase/server";
import { deleteUser, signedInUser, type Db } from "./helpers";

let a: { id: string; db: Db };
let b: { id: string; db: Db };
let intro: string;
let stats: string;
let bCourse: string;
const asServer = (db: Db) => db as unknown as ServerSupabase;

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("prereq-a"), signedInUser("prereq-b")]);
  intro = (await a.db.from("courses").insert({ title: "Intro" }).select("id").single()).data!.id;
  stats = (await a.db.from("courses").insert({ title: "Stats" }).select("id").single()).data!.id;
  bCourse = (await b.db.from("courses").insert({ title: "B course" }).select("id").single()).data!.id;
});
afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("learning trail links", () => {
  it("links the student's own courses and refuses loops", async () => {
    await addPrerequisite(asServer(a.db), stats, intro);
    expect(await listPrerequisites(asServer(a.db))).toEqual([{ courseId: stats, requiresId: intro }]);
    await expect(addPrerequisite(asServer(a.db), intro, stats)).rejects.toMatchObject({ code: "cycle" });
  });

  it("can't link to or read another student's courses", async () => {
    await expect(addPrerequisite(asServer(b.db), bCourse, intro)).rejects.toMatchObject({ status: 404 });
    expect(await listPrerequisites(asServer(b.db))).toEqual([]);
    const forged = await b.db.from("course_prerequisites").insert({ course_id: stats, requires_course_id: intro });
    expect(forged.error).not.toBeNull();
  });
});
