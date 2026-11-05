import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; db: Db };
let owner: User; // admin of org A
let teacher: User;
let s1: User;
let s2: User;
let s3: User;
let s4: User; // student who never shares
let outsider: User; // admin of org B
let orgA: string;
let orgB: string;
let code: string;
const users = () => [owner, teacher, s1, s2, s3, s4, outsider].filter(Boolean);
const days = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

async function withDeadline(u: User, title: string) {
  const res = await u.db.from("courses").insert({ title: "Statistics" }).select("id").single();
  if (res.error) throw new Error(JSON.stringify(res.error));
  const course = res.data.id;
  await u.db.from("assignments").insert({ course_id: course, title, due_at: days(3), estimated_minutes: 60 });
}

beforeAll(async () => {
  [owner, teacher, s1, s2, s3, s4, outsider] = await Promise.all(["org-owner", "org-teacher", "org-s1", "org-s2", "org-s3", "org-s4", "org-out"].map((l) => signedInUser(l)));
  orgA = (await owner.db.rpc("create_organization", { p_name: "Stats 101, Fall" })).data as string;
  orgB = (await outsider.db.rpc("create_organization", { p_name: "Other school" })).data as string;
  code = (await owner.db.rpc("organization_join_code", { p_org: orgA })).data as string;
  for (const u of [s1, s2, s3, s4]) await withDeadline(u, "Private worksheet");
});

afterAll(async () => {
  await Promise.all(users().map((u) => deleteUser(u.id)));
});

describe("organisations and memberships", () => {
  it("creates an organisation with its creator as admin and a 10-character join code only staff can read", async () => {
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    const { data: mine } = await owner.db.from("memberships").select("org_id, role, share_progress").eq("org_id", orgA);
    expect(mine).toEqual([{ org_id: orgA, role: "admin", share_progress: false }]);
    // The join code column isn't readable through the table.
    const direct = await owner.db.from("organizations").select("join_code").eq("id", orgA);
    expect(direct.error?.code).toBe("42501");
  });

  it("lets students join by code (any case, idempotent) as students with sharing off", async () => {
    for (const u of [teacher, s1, s2, s3, s4]) expect((await u.db.rpc("join_organization", { p_code: code.toLowerCase() })).error).toBeNull();
    expect((await s1.db.rpc("join_organization", { p_code: code })).error).toBeNull();
    const { data } = await s1.db.from("memberships").select("role, share_progress").eq("org_id", orgA);
    expect(data).toEqual([{ role: "student", share_progress: false }]);
    expect((await s1.db.rpc("join_organization", { p_code: "AAAAAAAAAA" })).error?.code).toBe("P0002");
  });

  it("blocks direct writes: memberships and organisations change only through the functions", async () => {
    expect((await s1.db.from("memberships").insert({ org_id: orgB, user_id: s1.id, role: "admin" })).error?.code).toBe("42501");
    expect((await s1.db.from("memberships").update({ role: "admin" }).eq("org_id", orgA)).error?.code).toBe("42501");
    expect((await s1.db.from("organizations").update({ name: "Hacked" }).eq("id", orgA)).error?.code).toBe("42501");
  });

  it("only an admin changes roles, and the last admin can't step down", async () => {
    expect((await s1.db.rpc("set_member_role", { p_org: orgA, p_user: s1.id, p_role: "admin" })).error?.code).toBe("42501");
    expect((await owner.db.rpc("set_member_role", { p_org: orgA, p_user: teacher.id, p_role: "teacher" })).error).toBeNull();
    expect((await owner.db.rpc("set_member_role", { p_org: orgA, p_user: owner.id, p_role: "student" })).error?.code).toBe("23514");
    expect((await owner.db.rpc("leave_organization", { p_org: orgA })).error?.code).toBe("23514");
  });

  it("students see only their own membership; staff see the roster (name, role, sharing) and nothing else", async () => {
    const { data: own } = await s1.db.from("memberships").select("user_id").eq("org_id", orgA);
    expect(own!.map((m) => m.user_id)).toEqual([s1.id]);
    expect((await s1.db.rpc("org_members", { p_org: orgA })).error?.code).toBe("42501");
    const roster = (await teacher.db.rpc("org_members", { p_org: orgA })).data as { user_id: string; role: string }[];
    expect(roster).toHaveLength(6);
    expect(Object.keys(roster[0]).sort()).toEqual(["display_name", "joined_at", "role", "share_progress", "user_id"]);
    // Membership doesn't open the students' own data to staff.
    const { data: theirs } = await teacher.db.from("assignments").select("id");
    expect(theirs).toEqual([]);
  });

  it("keeps organisations apart: an outsider sees nothing of org A and can't call its functions", async () => {
    expect((await outsider.db.from("organizations").select("id").eq("id", orgA)).data).toEqual([]);
    expect((await outsider.db.from("memberships").select("user_id").eq("org_id", orgA)).data).toEqual([]);
    for (const fn of ["org_members", "organization_join_code"] as const) expect((await outsider.db.rpc(fn, { p_org: orgA })).error?.code).toBe("42501");
    expect((await outsider.db.rpc("org_class_summary", { p_org: orgA, p_since: days(-7) })).error?.code).toBe("42501");
    expect((await teacher.db.from("organizations").select("id").eq("id", orgB)).data).toEqual([]);
  });

  it("class aggregates count consenting students only and stay hidden below 3 of them", async () => {
    expect((await s1.db.rpc("org_class_summary", { p_org: orgA, p_since: days(-7) })).error?.code).toBe("42501");
    for (const u of [s1, s2]) await u.db.rpc("set_share_progress", { p_org: orgA, p_share: true });
    const hidden = ((await teacher.db.rpc("org_class_summary", { p_org: orgA, p_since: days(-7) })).data as Record<string, unknown>[])[0];
    expect(hidden).toMatchObject({ members: 6, students: 4, sharing: 2, shown: false, assignments_due_7d: null });
    await s3.db.rpc("set_share_progress", { p_org: orgA, p_share: true });
    const shown = ((await teacher.db.rpc("org_class_summary", { p_org: orgA, p_since: days(-7) })).data as Record<string, unknown>[])[0];
    // s4 never shared, so their deadline isn't counted: 3, not 4.
    expect(shown).toMatchObject({ sharing: 3, shown: true, assignments_due_7d: 3, overdue_assignments: 0, blocks_completed: 0 });
    // Withdrawing consent takes effect at once.
    await s3.db.rpc("set_share_progress", { p_org: orgA, p_share: false });
    expect(((await teacher.db.rpc("org_class_summary", { p_org: orgA, p_since: days(-7) })).data as Record<string, unknown>[])[0]).toMatchObject({ sharing: 2, shown: false });
  });

  it("a student can leave; demo (anonymous) accounts can't create or join", async () => {
    expect((await s4.db.rpc("leave_organization", { p_org: orgA })).error).toBeNull();
    expect((await s4.db.from("organizations").select("id").eq("id", orgA)).data).toEqual([]);
    const demo = anon();
    const signedIn = await demo.auth.signInAnonymously();
    expect(signedIn.error).toBeNull();
    try {
      expect((await demo.rpc("create_organization", { p_name: "Demo school" })).error?.code).toBe("42501");
      expect((await demo.rpc("join_organization", { p_code: code })).error?.code).toBe("42501");
    } finally {
      await deleteUser(signedIn.data.user!.id);
    }
  });
});

describe("before migration 0018 reaches a database", () => {
  it("PostgREST reports a missing table or function with the codes the app treats as 'not set up yet'", async () => {
    const { isMissingSchema } = await import("@/lib/http/errors");
    const table = await owner.db.from("no_such_table_xyz" as "memberships").select("org_id");
    const fn = await owner.db.rpc("no_such_function_xyz" as "org_role", { p_org: orgA });
    expect(isMissingSchema(table.error)).toBe(true);
    expect(isMissingSchema(fn.error)).toBe(true);
    expect(isMissingSchema({ code: "42501" })).toBe(false);
  });
});
