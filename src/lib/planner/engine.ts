/**
 * Deterministic recovery planning engine. Pure functions: no I/O, no AI, no clock reads (callers pass `now`).
 *
 * Model
 * - Availability: one study window per local calendar day in the student's IANA time zone, starting at
 *   `studyStartTime` and lasting `weeklyMinutes[weekday]` minutes (DST-safe via TZDate).
 * - Work items carry minutes, a deadline (or none = "by the end of the horizon") and a tier:
 *   required (always included), recommended, optional.
 * - Scheduling: earliest-deadline-first, filling windows in time order with blocks of at most 90 minutes and
 *   a 10-minute break between consecutive blocks in the same window. With every item available now, EDF is
 *   optimal for meeting deadlines: if EDF leaves minutes unscheduled, no ordering of the same blocks fits.
 * - Scenarios: essential = required + first recommended item; balanced = required + recommended;
 *   full = everything. A scenario is feasible only if every included item is fully scheduled before its
 *   deadline. Shortfall minutes are reported, never hidden.
 */
import { TZDate } from "@date-fns/tz";

export const BLOCK_RULES = { maxBlockMinutes: 90, minBlockMinutes: 15, breakMinutes: 10 } as const;
export const HORIZON_RULES = { minDays: 7, maxDays: 21 } as const;

export type Tier = "required" | "recommended" | "optional";
export type ItemKind = "assignment" | "study" | "review";
export type Evidence = { documentId: string; page: number; filename?: string };

export type WorkItem = {
  id: string;
  kind: ItemKind;
  title: string;
  courseId: string;
  assignmentId?: string | null;
  minutes: number;
  /** ISO instant; null means "any time before the end of the planning horizon". */
  deadline: string | null;
  tier: Tier;
  evidence?: Evidence[];
  /** Short, factual reason shown to the student. */
  rationale?: string;
};

export type Availability = { timezone: string; weeklyMinutes: number[]; studyStartTime: string };

export type Window = { start: number; end: number };

export type PlannedTask = {
  itemId: string;
  title: string;
  kind: ItemKind;
  courseId: string;
  assignmentId: string | null;
  startsAt: string;
  endsAt: string;
  minutes: number;
  evidence: Evidence[];
};

export type ItemOutcome = {
  id: string;
  title: string;
  tier: Tier;
  kind: ItemKind;
  courseId: string;
  minutes: number;
  deadline: string | null;
  scheduledMinutes: number;
  unscheduledMinutes: number;
  status: "scheduled" | "partial" | "unscheduled";
  finishesAt: string | null;
  rationale?: string;
};

export type ScenarioKey = "essential" | "balanced" | "full";

export type ScenarioResult = {
  key: ScenarioKey;
  title: string;
  description: string;
  requiredMinutes: number;
  scheduledMinutes: number;
  shortfallMinutes: number;
  availableMinutes: number;
  /** Study minutes between now and this route's latest deadline (what actually constrains it). */
  availableBeforeDeadlineMinutes: number;
  /** Latest deadline among the route's items (or the horizon end). */
  lastDeadline: string;
  coveragePercent: number;
  feasible: boolean;
  items: ItemOutcome[];
  tasks: PlannedTask[];
};

export type PlanResult = {
  generatedAt: string;
  horizon: { start: string; end: string };
  availableMinutes: number;
  scenarios: ScenarioResult[];
  /** Required work whose deadline has already passed; never silently scheduled. */
  overdue: { id: string; title: string; deadline: string; minutes: number }[];
};

const MINUTE = 60_000;
const DAY = 86_400_000;

function parseStart(hhmm: string): [number, number] {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  if (!m) throw new RangeError("studyStartTime must be HH:MM");
  return [Number(m[1]), Number(m[2])];
}

/** Daily study windows between `from` and `to` (epoch ms), in the student's local time. */
export function availabilityWindows(availability: Availability, from: number, to: number): Window[] {
  const { timezone, weeklyMinutes } = availability;
  if (weeklyMinutes.length !== 7 || weeklyMinutes.some((m) => !Number.isFinite(m) || m < 0)) throw new RangeError("weeklyMinutes must be 7 non-negative numbers");
  const [hh, mm] = parseStart(availability.studyStartTime);
  const windows: Window[] = [];
  const first = new TZDate(from, timezone);
  // Start one day early so a window that began yesterday evening and runs past midnight is included.
  for (let offset = -1; ; offset++) {
    const start = new TZDate(first.getFullYear(), first.getMonth(), first.getDate() + offset, hh, mm, 0, timezone);
    const startMs = start.getTime();
    if (startMs >= to) break;
    const minutes = weeklyMinutes[(start.getDay() + 6) % 7];
    if (minutes <= 0) continue;
    const s = Math.max(startMs, from);
    const e = Math.min(startMs + minutes * MINUTE, to);
    if (e - s >= BLOCK_RULES.minBlockMinutes * MINUTE) windows.push({ start: s, end: e });
  }
  return windows;
}

/** EDF order; ties broken by tier, then input order (stable). */
function edfOrder(items: WorkItem[], horizonEnd: number): WorkItem[] {
  const tierRank: Record<Tier, number> = { required: 0, recommended: 1, optional: 2 };
  return items
    .map((item, index) => ({ item, index, due: item.deadline ? Date.parse(item.deadline) : horizonEnd }))
    .sort((a, b) => a.due - b.due || tierRank[a.item.tier] - tierRank[b.item.tier] || a.index - b.index)
    .map((x) => x.item);
}

/** Places items into windows. Returns tasks plus per-item outcomes. */
export function schedule(items: WorkItem[], windows: Window[], horizonEnd: number): { tasks: PlannedTask[]; outcomes: ItemOutcome[] } {
  const { maxBlockMinutes, minBlockMinutes, breakMinutes } = BLOCK_RULES;
  const tasks: PlannedTask[] = [];
  const outcomes: ItemOutcome[] = [];
  let w = 0;
  let cursor = windows[0]?.start ?? horizonEnd;

  for (const item of edfOrder(items, horizonEnd)) {
    const deadline = Math.min(item.deadline ? Date.parse(item.deadline) : horizonEnd, horizonEnd);
    let remaining = Math.round(item.minutes);
    let part = 0;
    const blocks: { start: number; end: number }[] = [];

    while (remaining > 0 && w < windows.length) {
      const win = windows[w];
      if (cursor < win.start) cursor = win.start;
      const limit = Math.min(win.end, deadline);
      const space = Math.floor((limit - cursor) / MINUTE);
      const needed = Math.min(minBlockMinutes, remaining);
      if (space < needed) {
        // Limited by this item's deadline (not the window): stop here and keep the window for later items.
        if (deadline <= win.end) break;
        w++;
        cursor = windows[w]?.start ?? horizonEnd;
        continue;
      }
      const length = Math.min(remaining, maxBlockMinutes, space);
      blocks.push({ start: cursor, end: cursor + length * MINUTE });
      remaining -= length;
      cursor += (length + breakMinutes) * MINUTE;
      if (cursor >= win.end) {
        w++;
        cursor = windows[w]?.start ?? horizonEnd;
      }
    }

    const total = blocks.length;
    for (const block of blocks) {
      part++;
      tasks.push({
        itemId: item.id,
        title: total > 1 ? `${item.title} (part ${part} of ${total})` : item.title,
        kind: item.kind,
        courseId: item.courseId,
        assignmentId: item.assignmentId ?? null,
        startsAt: new Date(block.start).toISOString(),
        endsAt: new Date(block.end).toISOString(),
        minutes: Math.round((block.end - block.start) / MINUTE),
        evidence: item.evidence ?? [],
      });
    }
    const scheduled = Math.round(item.minutes) - remaining;
    outcomes.push({
      id: item.id,
      title: item.title,
      tier: item.tier,
      kind: item.kind,
      courseId: item.courseId,
      minutes: Math.round(item.minutes),
      deadline: item.deadline,
      scheduledMinutes: scheduled,
      unscheduledMinutes: remaining,
      status: remaining === 0 ? "scheduled" : scheduled > 0 ? "partial" : "unscheduled",
      finishesAt: blocks.length ? new Date(blocks[blocks.length - 1].end).toISOString() : null,
      rationale: item.rationale,
    });
  }
  // Restore caller order for display; tasks stay chronological.
  const order = new Map(items.map((it, i) => [it.id, i]));
  outcomes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  tasks.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { tasks, outcomes };
}

const SCENARIO_COPY: Record<ScenarioKey, { title: string; description: string }> = {
  essential: { title: "Essential rescue", description: "Every required deadline plus the single most important study topic." },
  balanced: { title: "Balanced recovery", description: "Required work plus all recommended study and review sessions." },
  full: { title: "Full catch-up", description: "Everything, including optional work, if your time allows it." },
};

export function selectScenarioItems(key: ScenarioKey, items: WorkItem[]): WorkItem[] {
  const required = items.filter((i) => i.tier === "required");
  const recommended = items.filter((i) => i.tier === "recommended");
  const optional = items.filter((i) => i.tier === "optional");
  if (key === "essential") return [...required, ...recommended.slice(0, 1)];
  if (key === "balanced") return [...required, ...recommended];
  return [...required, ...recommended, ...optional];
}

/** Planning horizon: now until the latest deadline (at least 7, at most 21 days). */
export function planningHorizon(items: WorkItem[], now: number): { start: number; end: number } {
  const latest = Math.max(now, ...items.map((i) => (i.deadline ? Date.parse(i.deadline) : now)));
  const end = Math.min(Math.max(latest, now + HORIZON_RULES.minDays * DAY), now + HORIZON_RULES.maxDays * DAY);
  return { start: now, end };
}

export function validateItems(items: WorkItem[]) {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new RangeError(`Duplicate work item id ${item.id}`);
    ids.add(item.id);
    if (!Number.isFinite(item.minutes) || item.minutes <= 0 || item.minutes > 10080) throw new RangeError(`Invalid minutes for ${item.id}`);
    if (item.deadline !== null && Number.isNaN(Date.parse(item.deadline))) throw new RangeError(`Invalid deadline for ${item.id}`);
  }
}

/** Computes all three scenarios against the same availability. */
export function planScenarios(input: { items: WorkItem[]; availability: Availability; now: number }): PlanResult {
  const { availability, now } = input;
  validateItems(input.items);
  const overdue = input.items
    .filter((i) => i.tier === "required" && i.deadline && Date.parse(i.deadline) <= now)
    .map((i) => ({ id: i.id, title: i.title, deadline: i.deadline!, minutes: i.minutes }));
  const overdueIds = new Set(overdue.map((o) => o.id));
  const items = input.items.filter((i) => !overdueIds.has(i.id) && !(i.deadline && Date.parse(i.deadline) <= now));
  const horizon = planningHorizon(items, now);
  const windows = availabilityWindows(availability, horizon.start, horizon.end);
  const availableMinutes = Math.round(windows.reduce((sum, w) => sum + (w.end - w.start), 0) / MINUTE);

  const scenarios = (["essential", "balanced", "full"] as const).map((key): ScenarioResult => {
    const chosen = selectScenarioItems(key, items);
    const { tasks, outcomes } = schedule(chosen, windows, horizon.end);
    const requiredMinutes = outcomes.reduce((s, o) => s + o.minutes, 0);
    const scheduledMinutes = outcomes.reduce((s, o) => s + o.scheduledMinutes, 0);
    const shortfallMinutes = requiredMinutes - scheduledMinutes;
    const last = chosen.length ? Math.max(...chosen.map((i) => (i.deadline ? Math.min(Date.parse(i.deadline), horizon.end) : horizon.end))) : horizon.end;
    const availableBeforeDeadlineMinutes = Math.round(windows.reduce((sum, w) => sum + Math.max(0, Math.min(w.end, last) - w.start), 0) / MINUTE);
    return {
      key,
      ...SCENARIO_COPY[key],
      requiredMinutes,
      scheduledMinutes,
      shortfallMinutes,
      availableMinutes,
      availableBeforeDeadlineMinutes,
      lastDeadline: new Date(last).toISOString(),
      coveragePercent: requiredMinutes === 0 ? 100 : Math.floor((scheduledMinutes / requiredMinutes) * 100),
      feasible: requiredMinutes > 0 && shortfallMinutes === 0,
      items: outcomes,
      tasks,
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    horizon: { start: new Date(horizon.start).toISOString(), end: new Date(horizon.end).toISOString() },
    availableMinutes,
    scenarios,
    overdue,
  };
}

/** Scales a weekly availability to a new weekly total (what-if slider), preserving the day pattern. */
export function scaleWeekly(weekly: number[], targetWeeklyMinutes: number): number[] {
  const total = weekly.reduce((s, m) => s + m, 0);
  const base = total > 0 ? weekly : [1, 1, 1, 1, 1, 1, 1];
  const baseTotal = base.reduce((s, m) => s + m, 0);
  const scaled = base.map((m) => Math.min(720, Math.round(((m / baseTotal) * targetWeeklyMinutes) / 5) * 5));
  return scaled;
}
