import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteUnderAgeAccount } from "@/lib/account/under-age";
import { runRecoveryAgent } from "@/lib/agents/recovery-agent";
import { ScriptedModel, ScriptedProvider } from "@/lib/agents/testing/scripted-model";
import { buildDisclosure } from "@/lib/disclosure/build";
import { loadDisclosure } from "@/lib/disclosure/service";
import { createProposal } from "@/lib/planner/service";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("trust-a"), signedInUser("trust-b")]);
  await a.db.from("profiles").update({ timezone: "Asia/Dubai", weekly_minutes: [120, 120, 120, 120, 120, 120, 120], study_start_time: "08:00", onboarded_at: new Date().toISOString() }).eq("id", a.id);
  const course = (await a.db.from("courses").insert({ title: "Statistics" }).select("id").single()).data!.id;
  await a.db.from("assignments").insert({ course_id: course, title: "Worksheet", due_at: new Date(Date.now() + 4 * 86400_000).toISOString(), estimated_minutes: 120 });
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("personal details never reach the model or the database", () => {
  it("masks emails, phone numbers and Emirates IDs in the copilot message", async () => {
    const model = new ScriptedModel([{ answer: { scope: "catchup", facts: [], suggestions: ["Start with the worksheet."], clarifyingQuestion: null, followUps: [] } }]);
    const outcome = await runRecoveryAgent({
      supabase: asServer(a.db),
      admin: adminDb(),
      userId: a.id,
      courseId: null,
      message: "I'm sara@example.com, +971 50 123 4567, ID 784-1990-1234567-1. When is my worksheet due?",
      runtime: { provider: new ScriptedProvider(model), model: "scripted-test-model" },
      embedder: null,
      now: Date.now(),
      judge: null,
    });
    const sent = JSON.stringify(model.requests[0].input);
    for (const secret of ["sara@example.com", "123 4567", "784-1990-1234567-1"]) expect(sent).not.toContain(secret);
    expect(sent).toContain("When is my worksheet due?");
    const { data } = await admin().from("agent_runs").select("request_text").eq("id", outcome.runId).single();
    expect(data!.request_text).toBe("I'm [email removed], [phone removed], ID [Emirates ID removed]. When is my worksheet due?");
  });
});

describe("AI-use disclosure", () => {
  it("lists the student's own AI use only", async () => {
    await createProposal({ supabase: asServer(a.db), admin: adminDb(), userId: a.id, scenario: "essential", now: Date.now() });
    const mine = await loadDisclosure(asServer(a.db), a.id, Date.now());
    expect(mine.runs.map((r) => r.question)).toContain("I'm [email removed], [phone removed], ID [Emirates ID removed]. When is my worksheet due?");
    expect(mine.plans).toEqual([expect.objectContaining({ origin: "student", scenario: "essential", status: "pending" })]);
    expect(buildDisclosure(mine)).toContain("When is my worksheet due?");
    const theirs = await loadDisclosure(asServer(b.db), b.id, Date.now());
    expect(theirs).toMatchObject({ runs: [], plans: [], memories: [] });
  });
});

describe("under 13: a polite stop, nothing kept", () => {
  it("deletes a new account that says it is under 13, and refuses for an onboarded one", async () => {
    const child = await signedInUser("trust-under13");
    await deleteUnderAgeAccount(asServer(child.db), adminDb(), child.id);
    const { data } = await admin().auth.admin.getUserById(child.id);
    expect(data.user).toBeNull();
    await expect(deleteUnderAgeAccount(asServer(a.db), adminDb(), a.id)).rejects.toMatchObject({ status: 409 });
    expect((await admin().auth.admin.getUserById(a.id)).data.user?.id).toBe(a.id);
  });
});
