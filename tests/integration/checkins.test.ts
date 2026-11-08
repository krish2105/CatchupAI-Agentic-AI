import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as cronNudges } from "@/app/api/cron/nudges/route";
import { getCheckinPref, getProactiveDraft, PROACTIVE_TTL_MS, runCheckins, saveCheckinPref } from "@/lib/checkin/service";
import { approveProposal, createProposal, rejectProposal } from "@/lib/planner/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, anon, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;
const key = () => crypto.randomUUID().replaceAll("-", "");
const users: User[] = [];
let slipping: User; // A: missed a block
let onTrack: User; // B
let dismisser: User; // C
let optedOut: User; // D
let hasDraft: User; // E: made their own draft
let demoId: string | undefined;

/** A student with an approved plan (Worksheet, 3 h, due in 4 days); `miss` moves their first block into yesterday. */
async function studentWithPlan(label: string, miss: boolean, db?: Db, id?: string): Promise<{ id: string; db: Db }> {
  const user = db && id ? { id, db } : await signedInUser(label);
  await user.db.from("profiles").update({ timezone: "UTC", weekly_minutes: [120, 120, 120, 120, 120, 120, 120], study_start_time: "08:00" }).eq("id", user.id);
  const course = await user.db.from("courses").insert({ title: "Statistics" }).select("id").single();
  await user.db.from("assignments").insert({ course_id: course.data!.id, title: "Worksheet", due_at: new Date(Date.now() + 4 * 86400_000).toISOString(), estimated_minutes: 180 });
  const draft = await createProposal({ supabase: asServer(user.db), admin: adminDb(), userId: user.id, scenario: "essential", now: Date.now() });
  await approveProposal(asServer(user.db), draft.id, key());
  if (miss) {
    const { data: first } = await user.db.from("study_tasks").select("id, duration_minutes").eq("status", "todo").order("starts_at").limit(1).single();
    const start = Date.now() - 86400_000;
    await admin().from("study_tasks").update({ starts_at: new Date(start).toISOString(), ends_at: new Date(start + first!.duration_minutes! * 60_000).toISOString() }).eq("id", first!.id);
  }
  return user;
}

const proactiveDrafts = async (ownerId: string) =>
  (await admin().from("action_proposals").select("id, status, reason, proactive, checkin_on, run_id, expires_at, created_at").eq("owner_id", ownerId).eq("proactive", true)).data ?? [];

beforeAll(async () => {
  slipping = (await studentWithPlan("checkin-a", true)) as User;
  onTrack = (await studentWithPlan("checkin-b", false)) as User;
  dismisser = (await studentWithPlan("checkin-c", true)) as User;
  optedOut = (await studentWithPlan("checkin-d", true)) as User;
  hasDraft = (await studentWithPlan("checkin-e", true)) as User;
  users.push(slipping, onTrack, dismisser, optedOut, hasDraft);
  await saveCheckinPref(asServer(optedOut.db), false);
  await createProposal({ supabase: asServer(hasDraft.db), admin: adminDb(), userId: hasDraft.id, scenario: "essential", now: Date.now() });
  const demo = anon();
  const signed = await demo.auth.signInAnonymously();
  demoId = signed.data.user?.id;
  if (demoId) await studentWithPlan("checkin-demo", true, demo, demoId);
}, 120_000);

afterAll(async () => {
  await Promise.all([...users.map((u) => deleteUser(u.id)), demoId && deleteUser(demoId)]);
});

describe("proactive check-in", () => {
  it("drafts a re-plan, with the reason, only for students who are slipping and haven't opted out", async () => {
    const ids = [...users.map((u) => u.id), ...(demoId ? [demoId] : [])];
    const result = await runCheckins({ admin: adminDb(), now: Date.now(), ownerIds: ids });
    expect(result).toMatchObject({ available: true, considered: ids.length, drafted: 2 });

    const [mine] = await proactiveDrafts(slipping.id);
    expect(mine).toMatchObject({ status: "pending", proactive: true, run_id: null, checkin_on: new Date().toISOString().slice(0, 10) });
    expect(mine.reason).toMatch(/^1 block missed \(\d+ min\); Worksheet no longer fits by \d+ min$/);
    expect(Date.parse(mine.expires_at) - Date.parse(mine.created_at)).toBeGreaterThan(PROACTIVE_TTL_MS - 60_000);

    expect(await proactiveDrafts(onTrack.id)).toEqual([]);
    expect(await proactiveDrafts(optedOut.id)).toEqual([]);
    if (demoId) expect(await proactiveDrafts(demoId)).toEqual([]);
    // The student's own pending draft is left alone.
    expect(await proactiveDrafts(hasDraft.id)).toEqual([]);
    const own = await admin().from("action_proposals").select("status").eq("owner_id", hasDraft.id).eq("proactive", false).order("created_at", { ascending: false }).limit(1).single();
    expect(own.data?.status).toBe("pending");
  });

  it("shows the draft to its owner only, and students can't change its reason or flags", async () => {
    const draft = await getProactiveDraft(asServer(slipping.db), Date.now());
    expect(draft?.reason).toMatch(/block missed/);
    expect(draft?.proposal.status).toBe("pending");
    // Built from this student's rows only, although the job reads with the service role (every student here has
    // an identical "Statistics / Worksheet", so a missing owner filter would pull in other students' courses).
    const ownCourses = (await slipping.db.from("courses").select("id")).data!.map((c) => c.id);
    expect(draft!.proposal.payload.tasks.length).toBeGreaterThan(0);
    expect(draft!.proposal.payload.tasks.every((t) => ownCourses.includes(t.courseId))).toBe(true);
    expect(draft!.proposal.payload.items.every((i) => ownCourses.includes(i.courseId))).toBe(true);
    expect(await getProactiveDraft(asServer(onTrack.db), Date.now())).toBeNull();
    const peek = await onTrack.db.from("action_proposals").select("id").eq("id", draft!.proposal.id);
    expect(peek.data).toEqual([]);
    const edit = await slipping.db.from("action_proposals").update({ reason: "approved by the AI" } as never).eq("id", draft!.proposal.id);
    expect(edit.error?.code).toBe("42501");
  });

  it("is approved through the existing transaction exactly once", async () => {
    const draft = (await getProactiveDraft(asServer(slipping.db), Date.now()))!;
    const before = (await slipping.db.from("study_plans").select("id")).data!.length;
    const first = await approveProposal(asServer(slipping.db), draft.proposal.id, key());
    const again = await approveProposal(asServer(slipping.db), draft.proposal.id, key());
    expect(again).toMatchObject({ planId: first.planId, alreadyApplied: true });
    expect((await slipping.db.from("study_plans").select("id")).data!.length).toBe(before + 1);
    expect(await getProactiveDraft(asServer(slipping.db), Date.now())).toBeNull();
  });

  it("dismissing saves nothing, and there is at most one check-in per day", async () => {
    const draft = (await getProactiveDraft(asServer(dismisser.db), Date.now()))!;
    const plansBefore = (await dismisser.db.from("study_plans").select("id, status")).data;
    await rejectProposal(asServer(dismisser.db), draft.proposal.id);
    expect((await dismisser.db.from("study_plans").select("id, status")).data).toEqual(plansBefore);
    expect(await getProactiveDraft(asServer(dismisser.db), Date.now())).toBeNull();

    const rerun = await runCheckins({ admin: adminDb(), now: Date.now(), ownerIds: [dismisser.id] });
    expect(rerun.drafted).toBe(0);
    // The scheduled run (every student with an active plan) doesn't draft for them again either.
    expect((await runCheckins({ admin: adminDb(), now: Date.now() })).available).toBe(true);
    expect((await proactiveDrafts(dismisser.id)).map((d) => d.status)).toEqual(["rejected"]);
  });

  it("opting out is per student and private", async () => {
    expect(await getCheckinPref(asServer(onTrack.db))).toBe(true);
    expect(await getCheckinPref(asServer(optedOut.db))).toBe(false);
    const forged = await onTrack.db.from("notification_prefs").insert({ owner_id: optedOut.id, proactive_checkin: true } as never);
    expect(forged.error?.code).toBe("42501");
    const touched = await onTrack.db.from("notification_prefs").update({ proactive_checkin: true } as never).eq("owner_id", optedOut.id).select("owner_id");
    expect(touched.data ?? []).toEqual([]);
    expect(await getCheckinPref(asServer(optedOut.db))).toBe(false);
  });

  it("runs from the daily cron even without email configured, and refuses callers without the secret", async () => {
    const secret = "test-cron-secret-0123456789abcdefghijkl";
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("CATCHUP_TEST_MODEL", "scripted");
    try {
      const url = `http://localhost/api/cron/nudges?owner=${onTrack.id}`;
      expect((await cronNudges(new Request(url))).status).toBe(403);
      expect((await cronNudges(new Request(url, { headers: { authorization: "Bearer wrong-secret-0123456789abcdefghijkl" } }))).status).toBe(403);
      const res = await cronNudges(new Request(url, { headers: { authorization: `Bearer ${secret}` } }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ checkins: { available: true, considered: 1, drafted: 0 }, nudges: { skipped: "mail_not_configured" } });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
