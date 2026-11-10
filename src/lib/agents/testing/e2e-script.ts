import { ScriptedModel, ScriptedProvider, type ScriptStep, type ScriptView } from "./scripted-model";

/**
 * Deterministic "brain" for browser E2E tests only. It always calls the real tools in a fixed order and
 * builds its answer from the actual tool outputs, so the UI, SSE stream, tools, citations and proposal
 * flow are exercised end to end without an LLM. It is NOT an AI and is labelled as such in the UI.
 */
export function e2eScript(courseId: string | null, message: string): ScriptStep[] {
  if (/\b(poem|joke|riddle)\b/i.test(message)) {
    return [{ answer: { scope: "out_of_scope", facts: [], suggestions: ["Here is a poem about the sea: the waves roll in…"], clarifyingQuestion: null, followUps: ["Another poem?"] } }];
  }
  const steps: ScriptStep[] = [
    { call: "get_student_memory", args: {} },
    { call: "get_study_preferences", args: {} },
    { call: "list_assignments", args: { courseId, includeCompleted: false } },
  ];
  // "Remember: ..." in the request exercises the suggest-then-confirm memory flow.
  const remember = /remember:\s*([^.\n]{3,200})/i.exec(message);
  if (remember) steps.push({ call: "suggest_memory", args: { text: remember[1].trim() } });
  if (courseId) steps.push({ call: "search_course_material", args: { courseId, query: message.slice(0, 300), topK: 3 } });
  steps.push({
    call: "draft_recovery_plan",
    args: (v: ScriptView) => {
      const hasSource = /<source id="S1"/.test(v.toolOutputs.join("\n"));
      return { scenario: "essential", studyItems: hasSource && courseId ? [{ title: "Review the cited notes", courseId, minutes: 30, sourceIds: ["S1"] }] : [] };
    },
  });
  steps.push({
    answer: (v: ScriptView) => {
      const all = v.toolOutputs.join("\n");
      const source = /<source id="S1" file="([^"]+)" page="(\d+)">\n([\s\S]*?)\n<\/source>/.exec(all);
      const draft = v.lastToolOutput.startsWith("{") ? (JSON.parse(v.lastToolOutput) as { feasible?: boolean; shortfallMinutes?: number }) : {};
      return {
        scope: "catchup",
        facts: source ? [{ statement: `Your notes say: "${source[3].slice(0, 160)}"`, sourceIds: ["S1"] }] : [],
        suggestions: [
          draft.feasible ? "The essential route fits your time. Review the draft in the Recovery lab." : `The essential route is short by ${draft.shortfallMinutes ?? "?"} minutes; consider more study time or the essential items only.`,
        ],
        clarifyingQuestion: source || !courseId ? null : "I couldn't verify that in your uploaded materials. Can you upload the notes for this topic?",
        followUps: ["What should I study first this week?", "Which pages cover this topic?"],
      };
    },
  });
  return steps;
}

export function scriptedRuntime(courseId: string | null, message: string) {
  return { provider: new ScriptedProvider(new ScriptedModel(e2eScript(courseId, message))), model: "scripted-test-model" };
}
