/**
 * "X of the last 7 days" (pure, client-safe). Counts days with at least one completed study block; the aim leaves
 * rest days on purpose, so a rest day is never a failure. Deliberately not a streak: nothing resets, there is no
 * "days in a row" count, no points and no ranking (docs/DECISIONS.md ADR-065, ADR-068).
 */
export const DAYS_AIM = 5;

export type StudyDay = { date: string; studied: boolean; minutes: number };

export function daysStudied(days: { date: string; minutes: number; blocks: number }[], aim = DAYS_AIM) {
  const last7: StudyDay[] = days.slice(-7).map((d) => ({ date: d.date, studied: d.blocks > 0, minutes: d.minutes }));
  const studied = last7.filter((d) => d.studied).length;
  const restDays = 7 - aim;
  const restLeft = Math.max(0, restDays - (7 - studied));
  const summary =
    studied >= aim
      ? `Studied on ${studied} of the last 7 days. That meets the aim of ${aim}, with rest days to spare.`
      : `Studied on ${studied} of the last 7 days. The aim is ${aim}; ${restDays} rest days a week are part of the plan.`;
  return { days: last7, studied, aim, restDays, restLeft, summary };
}
