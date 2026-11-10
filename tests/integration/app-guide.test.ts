import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INSTRUCTIONS, runRecoveryAgent } from "@/lib/agents/recovery-agent";
import { ScriptedModel, ScriptedProvider, type ScriptStep } from "@/lib/agents/testing/scripted-model";
import { getAgentRun } from "@/lib/db/agent-runs";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
const asServer = (db: Db) => db as unknown as ServerSupabase;
const adminDb = () => admin() as unknown as AdminSupabase;

async function run(message: string, steps: ScriptStep[]) {
  const model = new ScriptedModel(steps);
  const outcome = await runRecoveryAgent({
    supabase: asServer(a.db),
    admin: adminDb(),
    userId: a.id,
    courseId: null,
    message,
    runtime: { provider: new ScriptedProvider(model), model: "scripted-test-model" },
    embedder: null,
    now: Date.now(),
    judge: null,
  });
  return { outcome, model };
}

beforeAll(async () => {
  a = await signedInUser("guide-help-a");
});

afterAll(async () => {
  if (a) await deleteUser(a.id);
});

describe("questions about CatchUp itself", () => {
  it("tells the model to answer them from the app guide", () => {
    expect(INSTRUCTIONS).toContain("get_app_help");
    expect(INSTRUCTIONS).toMatch(/how to use CatchUp/i);
  });

  it("answers from the guide: guide statements are kept, an invented feature is removed, nothing is drafted", async () => {
    const question = "How do I approve a plan?";
    const { outcome, model } = await run(question, [
      { call: "get_app_help", args: { topic: "approve a plan" } },
      {
        answer: {
          scope: "catchup",
          facts: [
            { statement: "Routes that don't fit can't be approved.", sourceIds: [] },
            { statement: "CatchUp texts your parents whenever you skip homework.", sourceIds: [] },
          ],
          suggestions: ["Open the Recovery lab and approve the route you want."],
          clarifyingQuestion: null,
          followUps: [],
        },
      },
    ]);
    expect(outcome.status).toBe("completed");
    expect(outcome.events.map((e) => [e.tool, e.status])).toEqual([["get_app_help", "completed"]]);
    // The question's wording is not stored in the trace: only its length.
    expect(outcome.events[0].args).toEqual({ length: "approve a plan".length });
    expect(outcome.events[0].outcome).toMatch(/^Guide: /);
    expect(JSON.stringify(model.requests.at(-1)?.input)).toContain("CATCHUP_GUIDE");
    expect(outcome.answer?.facts).toEqual([{ statement: "Routes that don't fit can't be approved.", sourceIds: [] }]);
    expect(outcome.removedUnsupportedFacts).toBe(1);
    expect(outcome.proposalId).toBeNull();
    expect((await getAgentRun(asServer(a.db), outcome.runId)).events.map((e) => e.tool)).toEqual(["get_app_help"]);
  });

  it("removes a statement about the app when the guide wasn't read in this turn", async () => {
    const { outcome } = await run("Can routes that don't fit be approved?", [
      { answer: { scope: "catchup", facts: [{ statement: "Routes that don't fit can't be approved.", sourceIds: [] }], suggestions: [], clarifyingQuestion: null, followUps: [] } },
    ]);
    expect(outcome.answer?.facts).toEqual([]);
    expect(outcome.removedUnsupportedFacts).toBe(1);
  });
});
