import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveFeedback } from "@/lib/feedback/service";
import { unsubscribeSignature } from "@/lib/nudges/sign";
import { getNudgePrefs, saveNudgePrefs, sendDueNudges, unsubscribe, type Mail } from "@/lib/nudges/service";
import { approveProposal, createProposal } from "@/lib/planner/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, anon, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
let demoId: string | undefined;
let firstBlockAt: number;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const asAdmin = () => admin() as unknown as AdminSupabase;

beforeAll(async () => {
  process.env.CRON_SECRET ??= "integration-secret-".padEnd(40, "x");
  [a, b] = await Promise.all([signedInUser("nudge-a"), signedInUser("nudge-b")]);
  await a.db.from("profiles").update({ timezone: "UTC", display_name: "Alex", weekly_minutes: [120, 120, 120, 120, 120, 120, 120], study_start_time: "09:00" }).eq("id", a.id);
  const course = (await a.db.from("courses").insert({ title: "Stats" }).select("id").single()).data!.id;
  await a.db.from("assignments").insert({ course_id: course, title: "Problem sheet", due_at: new Date(Date.now() + 4 * 86400_000).toISOString(), estimated_minutes: 60 });
  const proposal = await createProposal({ supabase: asServer(a.db), admin: asAdmin(), userId: a.id, scenario: "essential", now: Date.now() });
  await approveProposal(asServer(a.db), proposal.id, "nudge-test-key-1");
  const { data } = await a.db.from("study_tasks").select("starts_at").order("starts_at").limit(1).single();
  firstBlockAt = Date.parse(data!.starts_at);
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id), demoId && deleteUser(demoId)]);
});

describe("study email preferences", () => {
  it("are off by default, saved per student, and private", async () => {
    expect(await getNudgePrefs(asServer(a.db))).toEqual({ dailyDigest: false, missedAlert: false });
    await saveNudgePrefs(asServer(a.db), { dailyDigest: true, missedAlert: true });
    await saveNudgePrefs(asServer(a.db), { dailyDigest: true, missedAlert: false });
    expect(await getNudgePrefs(asServer(a.db))).toEqual({ dailyDigest: true, missedAlert: false });
    expect(await getNudgePrefs(asServer(b.db))).toEqual({ dailyDigest: false, missedAlert: false });
    const forged = await b.db.from("notification_prefs").insert({ owner_id: a.id, daily_digest: false } as never);
    expect(forged.error?.code).toBe("42501");
    const sneaky = await a.db.from("notification_prefs").update({ last_sent_on: "2000-01-01" } as never).eq("owner_id", a.id);
    expect(sneaky.error?.code).toBe("42501");
  });
});

describe("daily nudge run", () => {
  it("emails only opted-in students with something to say, once a day, with a signed unsubscribe", async () => {
    await saveNudgePrefs(asServer(b.db), { dailyDigest: true, missedAlert: true }); // b has no plan: nothing to say
    const demo = anon();
    const signed = await demo.auth.signInAnonymously();
    demoId = signed.data.user?.id;
    if (demoId) await saveNudgePrefs(asServer(demo), { dailyDigest: true, missedAlert: true });

    const sent: Mail[] = [];
    const now = firstBlockAt - 3600_000;
    await sendDueNudges({ admin: asAdmin(), now, appUrl: "https://app.test", send: async (m) => { sent.push(m); } });
    const mine = sent.filter((m) => m.to === a.email);
    expect(mine).toHaveLength(1);
    expect(mine[0].subject).toMatch(/block/);
    expect(mine[0].text).toContain("Hi Alex");
    expect(mine[0].text).toContain("Next 24 hours:");
    expect(mine[0].unsubscribeUrl).toMatch(new RegExp(`^https://app.test/api/nudges/unsubscribe\\?u=${a.id}&s=[\\w-]{43}$`));
    expect(sent.some((m) => m.to === b.email)).toBe(false);
    expect(sent.some((m) => !m.to)).toBe(false);

    const again: Mail[] = [];
    await sendDueNudges({ admin: asAdmin(), now: now + 60_000, appUrl: "https://app.test", send: async (m) => { again.push(m); } });
    expect(again.filter((m) => m.to === a.email)).toHaveLength(0);
  });

  it("unsubscribe links: GET only confirms (scanners prefetch links), POST turns both emails off", async () => {
    const { GET, POST } = await import("@/app/api/nudges/unsubscribe/route");
    await saveNudgePrefs(asServer(a.db), { dailyDigest: true, missedAlert: true });
    const url = `https://app.test/api/nudges/unsubscribe?u=${a.id}&s=${unsubscribeSignature(a.id)}`;
    const shown = await GET(new Request(url));
    expect(shown.status).toBe(200);
    expect(await shown.text()).toContain('<form method="post"');
    expect(await getNudgePrefs(asServer(a.db))).toEqual({ dailyDigest: true, missedAlert: true });
    expect((await POST(new Request(url.replace(a.id, b.id), { method: "POST", body: "List-Unsubscribe=One-Click" }))).status).toBe(400);
    const oneClick = await POST(new Request(url, { method: "POST", body: "List-Unsubscribe=One-Click" }));
    expect(await oneClick.json()).toEqual({ unsubscribed: true });
    expect(await getNudgePrefs(asServer(a.db))).toEqual({ dailyDigest: false, missedAlert: false });
    await unsubscribe(asAdmin(), a.id);
  });
});

describe("feedback", () => {
  it("stores the student's own ratings and comments, privately", async () => {
    await saveFeedback(asServer(a.db), { kind: "answer", ref: "run-1", rating: 1, page: "/assistant" });
    await saveFeedback(asServer(a.db), { kind: "general", comment: "The catch-up pack saved my week." });
    const { data } = await a.db.from("feedback").select("kind, rating, comment, owner_id");
    expect(data).toHaveLength(2);
    expect(data!.every((f) => f.owner_id === a.id)).toBe(true);
    expect((await b.db.from("feedback").select("id")).data).toEqual([]);
    const forged = await b.db.from("feedback").insert({ owner_id: a.id, kind: "general", comment: "x" } as never);
    expect(forged.error?.code).toBe("42501");
    const empty = await a.db.from("feedback").insert({ kind: "general" });
    expect(empty.error?.code).toBe("23514");
  });
});
