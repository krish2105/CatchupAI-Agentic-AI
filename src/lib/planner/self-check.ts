import type { ItemOutcome, PlannedTask, PlanResult } from "./engine";

/**
 * Deterministic self-check run on every drafted plan, independent of the planner that produced it.
 * It re-derives the plan's promises from the blocks themselves:
 *   no_overlap       no two blocks share time, and each block's length matches its start/end;
 *   before_deadline  every block ends before the deadline of the work it belongs to;
 *   minutes_match    the minutes the plan says it scheduled per item equal the sum of that item's blocks;
 *   required_covered all required work fits; if not, which item, how many minutes and by when.
 * "fail" means the plan breaks a rule and must not be approved; "shortfall" means the plan is sound but some
 * required work doesn't fit, and says exactly what. Pure: used by the agent tool, the API and the UI.
 */
export type CheckablePlan = {
  items: Pick<ItemOutcome, "id" | "title" | "tier" | "deadline" | "scheduledMinutes" | "unscheduledMinutes">[];
  tasks: Pick<PlannedTask, "itemId" | "title" | "startsAt" | "endsAt" | "minutes">[];
  overdue: Pick<PlanResult["overdue"][number], "title">[];
  summary: { shortfallMinutes: number };
};

export type SelfCheckId = "no_overlap" | "before_deadline" | "minutes_match" | "required_covered";
export type SelfCheck = {
  status: "pass" | "shortfall" | "fail";
  checks: { id: SelfCheckId; label: string; ok: boolean; detail: string }[];
  shortfalls: { title: string; minutes: number; deadline: string | null }[];
  overdue: string[];
  summary: string;
};

const LABELS: Record<SelfCheckId, string> = {
  no_overlap: "No overlapping blocks",
  before_deadline: "Every block before its deadline",
  minutes_match: "Block minutes add up",
  required_covered: "All required work fits",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function selfCheckPlan(plan: CheckablePlan): SelfCheck {
  const tasks = [...plan.tasks].sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt));
  const items = new Map(plan.items.map((i) => [i.id, i]));

  const overlapProblems: string[] = [];
  for (const [i, t] of tasks.entries()) {
    const start = Date.parse(t.startsAt);
    const end = Date.parse(t.endsAt);
    if (!(end > start) || Math.round((end - start) / 60_000) !== t.minutes) overlapProblems.push(`“${t.title}” lasts ${Math.round((end - start) / 60_000)} min but claims ${t.minutes}`);
    const next = tasks[i + 1];
    if (next && Date.parse(next.startsAt) < end) overlapProblems.push(`“${t.title}” overlaps “${next.title}”`);
  }

  const lateProblems: string[] = [];
  for (const t of tasks) {
    const item = items.get(t.itemId);
    if (!item) lateProblems.push(`“${t.title}” belongs to no planned item`);
    else if (item.deadline && Date.parse(t.endsAt) > Date.parse(item.deadline)) lateProblems.push(`“${item.title}” has a block ending after its deadline`);
  }

  const minuteProblems: string[] = [];
  for (const item of plan.items) {
    const sum = tasks.filter((t) => t.itemId === item.id).reduce((s, t) => s + t.minutes, 0);
    if (sum !== item.scheduledMinutes) minuteProblems.push(`“${item.title}”: blocks sum to ${sum} min, plan says ${item.scheduledMinutes}`);
  }

  const shortfalls = plan.items
    .filter((i) => i.tier === "required" && i.unscheduledMinutes > 0)
    .map((i) => ({ title: i.title, minutes: i.unscheduledMinutes, deadline: i.deadline }));

  const checks: SelfCheck["checks"] = [
    { id: "no_overlap", label: LABELS.no_overlap, ok: overlapProblems.length === 0, detail: overlapProblems.join("; ") || `${plural(tasks.length, "block")}, none overlapping` },
    { id: "before_deadline", label: LABELS.before_deadline, ok: lateProblems.length === 0, detail: lateProblems.join("; ") || "All blocks end before their deadlines" },
    { id: "minutes_match", label: LABELS.minutes_match, ok: minuteProblems.length === 0, detail: minuteProblems.join("; ") || "Scheduled minutes match the blocks" },
    {
      id: "required_covered",
      label: LABELS.required_covered,
      ok: shortfalls.length === 0,
      detail: shortfalls.map((s) => `${s.title}: ${s.minutes} min don't fit${s.deadline ? " before its deadline" : ""}`).join("; ") || "All required work is scheduled",
    },
  ];

  const broken = checks.filter((c) => !c.ok && c.id !== "required_covered");
  const status: SelfCheck["status"] = broken.length ? "fail" : shortfalls.length ? "shortfall" : "pass";
  const overdue = plan.overdue.map((o) => o.title);
  const overdueNote = overdue.length ? ` ${plural(overdue.length, "overdue item")} ${overdue.length === 1 ? "is" : "are"} not scheduled.` : "";
  const summary =
    status === "fail"
      ? `Self-check failed: ${broken.map((c) => c.detail).join("; ")}. This draft can't be approved.`
      : status === "shortfall"
        ? `Self-check: the schedule is sound (${plural(tasks.length, "block")}, no overlaps, all before deadlines), but ${checks[3].detail}.${overdueNote}`
        : `Self-check passed: ${plural(tasks.length, "block")}, no overlaps, all before their deadlines.${overdueNote}`;
  return { status, checks, shortfalls, overdue, summary };
}
