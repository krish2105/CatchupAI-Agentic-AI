import { afterAll, describe, expect, it } from "vitest";
import { seedDemoAccount } from "@/lib/demo/seed";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, anon, deleteUser, signedInUser } from "./helpers";

const created: string[] = [];
afterAll(async () => {
  await Promise.all(created.map(deleteUser));
});

describe("one-click demo", () => {
  it("seeds an anonymous account once, through RLS, with an indexed synthetic PDF", async () => {
    const db = anon();
    const { data, error } = await db.auth.signInAnonymously();
    expect(error).toBeNull();
    const userId = data.user!.id;
    created.push(userId);
    const deps = { supabase: db as unknown as ServerSupabase, admin: admin() as unknown as AdminSupabase, userId, isAnonymous: true, timezone: "Asia/Dubai", now: Date.now(), embedder: null };
    expect(await seedDemoAccount(deps)).toEqual({ seeded: true });
    expect(await seedDemoAccount(deps)).toEqual({ seeded: false });

    const courses = await db.from("courses").select("title").order("title");
    expect(courses.data!.map((c) => c.title)).toEqual(["Applied Statistics", "Introduction to Programming"]);
    const docs = await db.from("documents").select("status, page_count");
    expect(docs.data).toEqual([{ status: "ready", page_count: 4 }]);
    const profile = await db.from("profiles").select("timezone, onboarded_at").eq("id", userId).single();
    expect(profile.data?.timezone).toBe("Asia/Dubai");
    expect(profile.data?.onboarded_at).not.toBeNull();
  });

  it("refuses to load demo data into a real (non-anonymous) account", async () => {
    const real = await signedInUser("demo-real");
    created.push(real.id);
    await expect(
      seedDemoAccount({ supabase: real.db as unknown as ServerSupabase, admin: admin() as unknown as AdminSupabase, userId: real.id, isAnonymous: false, timezone: "UTC", now: Date.now(), embedder: null }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await real.db.from("courses").select("id")).data).toEqual([]);
  });
});
