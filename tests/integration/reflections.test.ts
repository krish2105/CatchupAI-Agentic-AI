import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveReflection } from "@/lib/insights/week";
import { weekStart } from "@/lib/insights/reflection";
import type { ServerSupabase } from "@/lib/supabase/server";
import { deleteUser, signedInUser, type Db } from "./helpers";

let a: { id: string; db: Db };
let b: { id: string; db: Db };
const asServer = (db: Db) => db as unknown as ServerSupabase;

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("reflect-a"), signedInUser("reflect-b")]);
});
afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("weekly reflections", () => {
  const week = weekStart(Date.now(), "UTC");
  it("upserts one reflection per week for the owner", async () => {
    await saveReflection(asServer(a.db), { weekStart: week, wentWell: "A", wasHard: "", nextFocus: "" });
    const updated = await saveReflection(asServer(a.db), { weekStart: week, wentWell: "B", wasHard: "x", nextFocus: "" });
    expect(updated.wentWell).toBe("B");
    const { data } = await a.db.from("weekly_reflections").select("id");
    expect(data).toHaveLength(1);
  });

  it("keeps reflections private and rejects non-Monday weeks", async () => {
    const { data } = await b.db.from("weekly_reflections").select("id");
    expect(data).toEqual([]);
    const forged = await b.db.from("weekly_reflections").insert({ owner_id: a.id, week_start: week, went_well: "forged" });
    expect(forged.error).not.toBeNull();
    const tuesday = new Date(`${week}T12:00:00Z`);
    tuesday.setUTCDate(tuesday.getUTCDate() + 1);
    await expect(saveReflection(asServer(b.db), { weekStart: tuesday.toISOString().slice(0, 10), wentWell: "x", wasHard: "", nextFocus: "" })).rejects.toMatchObject({ status: 400 });
  });
});
