/**
 * When every route is short: why, and one practical next step. Pure and deterministic (no AI, no clock reads).
 * - why: the work due by the blocking deadline needs more minutes than the student's study time before it, and
 *   every route (even "Deadline first") includes that work, so all three show a shortfall.
 * - more_time: the smallest weekly total (5-minute grid, same day pattern) at which the deadline-first route fits.
 * - extension: when no amount of daily study fits, a polite extension request for the earliest short deadline.
 */
import { availabilityWindows, planScenarios, scaleWeekly, type Availability, type PlanResult, type WorkItem } from "@/lib/planner/engine";
import { formatMinutes } from "@/lib/time";

export type NextStep =
  | { kind: "more_time"; why: string; currentWeekly: number; weeklyTotal: number; extraPerWeek: number; days: { weekday: number; extra: number }[] }
  | { kind: "extension"; why: string; assignmentTitle: string; dueAt: string; shortMinutes: number; proposedDueAt: string; request: string };

const DAY = 86_400_000;
const MINUTE = 60_000;
const MAX_WEEKLY = 7 * 720;
/** The most study on one day that a next step may suggest (8 hours). */
export const PRACTICAL_DAY_MINUTES = 480;
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const formatDay = (iso: string, timezone: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));

function listTitles(titles: string[]) {
  const shown = titles.slice(0, 3).map((t) => `"${t}"`);
  if (titles.length > 3) shown.push(`${titles.length - 3} more`);
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : shown[0];
}

export function findNextStep(input: { items: WorkItem[]; availability: Availability; now: number; plan: PlanResult }): NextStep | null {
  const { items, availability, now, plan } = input;
  const essential = plan.scenarios.find((s) => s.key === "essential");
  if (!essential || essential.requiredMinutes === 0 || plan.scenarios.some((s) => s.feasible)) return null;
  const blocking = essential.items.filter((o) => o.unscheduledMinutes > 0);
  if (!blocking.length) return null;

  // Why: everything due by the latest blocking deadline competes for the same study time before it.
  const horizonEnd = Date.parse(plan.horizon.end);
  const due = (deadline: string | null) => (deadline ? Math.min(Date.parse(deadline), horizonEnd) : horizonEnd);
  const by = Math.max(...blocking.map((o) => due(o.deadline)));
  const dueBy = essential.items.filter((o) => due(o.deadline) <= by);
  const needed = sum(dueBy.map((o) => o.minutes));
  const available = Math.round(sum(availabilityWindows(availability, now, by).map((w) => (w.end - w.start) / MINUTE)));
  const why =
    `The work due by ${formatDay(new Date(by).toISOString(), availability.timezone)} (${listTitles(dueBy.map((o) => o.title))}) needs ${formatMinutes(needed)}, ` +
    `but you have ${formatMinutes(available)} of study time before then. Every route includes this work, so all three are short.`;

  // Smallest weekly total (5-minute grid) at which the deadline-first route fits, keeping the student's day pattern.
  const base = availability.weeklyMinutes;
  const currentWeekly = sum(base);
  const fits = (total: number) =>
    planScenarios({ items, availability: { ...availability, weeklyMinutes: scaleWeekly(base, total) }, now }).scenarios.find((s) => s.key === "essential")!.feasible;

  if (fits(MAX_WEEKLY)) {
    let lo = currentWeekly; // known not to fit
    let hi = MAX_WEEKLY; // known to fit
    while (hi - lo > 5) {
      const mid = lo + Math.max(5, Math.floor((hi - lo) / 10) * 5);
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    const weekly = scaleWeekly(base, hi);
    // A fix is only practical if no study day goes past 8 hours; otherwise the honest next step is an extension.
    if (Math.max(...weekly) <= PRACTICAL_DAY_MINUTES) {
      const days = weekly.map((m, weekday) => ({ weekday, extra: m - base[weekday] })).filter((d) => d.extra > 0);
      return { kind: "more_time", why, currentWeekly, weeklyTotal: hi, extraPerWeek: hi - currentWeekly, days };
    }
  }

  // No practical amount of daily study fits: ask for more time on the earliest short deadline.
  const target = [...blocking].sort((a, b) => due(a.deadline) - due(b.deadline))[0];
  const dueAt = target.deadline ?? plan.horizon.end;
  const averageDaily = Math.max(60, currentWeekly / 7);
  const proposedDueAt = new Date(Date.parse(dueAt) + Math.ceil(target.unscheduledMinutes / averageDaily) * DAY).toISOString();
  const request =
    `Dear [lecturer's name],\n\n` +
    `I missed a recent lecture and I'm working hard to catch up. I want to hand in good work for "${target.title}", which is due ${formatDay(dueAt, availability.timezone)}. ` +
    `Even studying as much as I realistically can each day, I'm about ${formatMinutes(target.unscheduledMinutes)} short. ` +
    `Could I please have an extension until ${formatDay(proposedDueAt, availability.timezone)}? I'm happy to share my study plan.\n\n` +
    `Thank you,\n[Your name]`;
  return { kind: "extension", why, assignmentTitle: target.title, dueAt, shortMinutes: target.unscheduledMinutes, proposedDueAt, request };
}
