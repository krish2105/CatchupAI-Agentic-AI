import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; db: Db };
let owner: User;
let teacher: User;
let student: User;
let late: User;
let org: string;
let code: string;
const audit = async () => ((await owner.db.from("org_audit_events").select("action, target_user, detail").eq("org_id", org).order("id")).data ?? []).map((e) => e.action);

beforeAll(async () => {
  [owner, teacher, student, late] = await Promise.all(["oab-owner", "oab-teacher", "oab-student", "oab-late"].map((l) => signedInUser(l)));
  org = (await owner.db.rpc("create_organization", { p_name: "Billing school" })).data as string;
  code = (await owner.db.rpc("organization_join_code", { p_org: org })).data as string;
  for (const u of [teacher, student]) await u.db.rpc("join_organization", { p_code: code });
  await owner.db.rpc("set_member_role", { p_org: org, p_user: teacher.id, p_role: "teacher" });
  await student.db.rpc("set_share_progress", { p_org: org, p_share: true });
});

afterAll(async () => {
  await Promise.all([owner, teacher, student, late].filter(Boolean).map((u) => deleteUser(u.id)));
});

describe("organisation admin: audit log, code rotation, seats", () => {
  it("records who did what, readable by admins only", async () => {
    expect(await audit()).toEqual(["org.created", "member.joined", "member.joined", "member.role_changed", "member.sharing_changed"]);
    const roleChange = (await owner.db.from("org_audit_events").select("detail, target_user").eq("action", "member.role_changed").single()).data!;
    expect(roleChange).toEqual({ detail: { from: "student", to: "teacher" }, target_user: teacher.id });
    expect((await teacher.db.from("org_audit_events").select("id").eq("org_id", org)).data).toEqual([]);
    expect((await student.db.from("org_audit_events").select("id").eq("org_id", org)).data).toEqual([]);
    expect((await owner.db.from("org_audit_events").insert({ org_id: org, action: "org.created" })).error?.code).toBe("42501");
  });

  it("rotating the join code makes the old one stop working at once", async () => {
    expect((await teacher.db.rpc("rotate_join_code", { p_org: org })).error?.code).toBe("42501");
    const fresh = (await owner.db.rpc("rotate_join_code", { p_org: org })).data as string;
    expect(fresh).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(fresh).not.toBe(code);
    expect((await late.db.rpc("join_organization", { p_code: code })).error?.code).toBe("P0002");
    code = fresh;
    expect((await audit()).at(-1)).toBe("code.rotated");
  });

  it("enforces the plan's seat limit when joining", async () => {
    await admin().from("organizations").update({ seat_limit: 3 }).eq("id", org);
    const full = await late.db.rpc("join_organization", { p_code: code });
    expect(full.error).toMatchObject({ code: "23514", message: "organisation is full" });
    // Existing members re-joining is a no-op, not a seat.
    expect((await student.db.rpc("join_organization", { p_code: code })).error).toBeNull();
  });

  it("members can read the plan and seat limit but never the billing ids; only admins see the billing summary", async () => {
    expect((await student.db.from("organizations").select("plan, seat_limit").eq("id", org).single()).data).toEqual({ plan: "free", seat_limit: 3 });
    expect((await student.db.from("organizations").select("stripe_customer_id").eq("id", org)).error?.code).toBe("42501");
    expect((await teacher.db.rpc("org_billing", { p_org: org })).error?.code).toBe("42501");
    expect(((await owner.db.rpc("org_billing", { p_org: org })).data as { members: number; plan: string }[])[0]).toMatchObject({ plan: "free", members: 3, has_customer: false });
  });
});

describe("billing state from Stripe webhooks (service role only)", () => {
  // Stripe event ids are global in stripe_events, so each run uses its own.
  const run = crypto.randomUUID().slice(0, 8);
  const apply = (id: string, at: string, plan: string, status: string, seats: number) =>
    admin().rpc("apply_org_subscription", { p_event_id: `${id}_${run}`, p_event_type: "customer.subscription.updated", p_event_at: at, p_org: org, p_plan: plan, p_status: status, p_seats: seats, p_period_end: "2026-12-05T00:00:00Z", p_customer: "cus_test_1", p_subscription: "sub_test_1" });

  it("can't be called by a signed-in user, even the admin", async () => {
    const r = await owner.db.rpc("apply_org_subscription", { p_event_id: "evt_x", p_event_type: "x", p_event_at: "2026-11-05T00:00:00Z", p_org: org, p_plan: "class", p_status: "active", p_seats: 999, p_period_end: null as unknown as string, p_customer: null as unknown as string, p_subscription: null as unknown as string });
    expect(r.error?.code).toBe("42501");
  });

  it("applies an event once (redelivery is a no-op) and ignores events older than the last applied", async () => {
    expect((await apply("evt_1", "2026-11-05T10:00:00Z", "class", "active", 300)).data).toBe(true);
    expect((await apply("evt_1", "2026-11-05T10:00:00Z", "class", "active", 300)).data).toBe(false);
    // An older "canceled" event arriving late must not undo the newer active subscription.
    expect((await apply("evt_0", "2026-11-05T09:00:00Z", "free", "canceled", 40)).data).toBe(false);
    const row = (await admin().from("organizations").select("plan, plan_status, seat_limit, stripe_customer_id").eq("id", org).single()).data;
    expect(row).toEqual({ plan: "class", plan_status: "active", seat_limit: 300, stripe_customer_id: "cus_test_1" });
    expect((await audit()).at(-1)).toBe("plan.changed");
    // With seats available again, the late student can join.
    expect((await late.db.rpc("join_organization", { p_code: code })).error).toBeNull();
  });
});
