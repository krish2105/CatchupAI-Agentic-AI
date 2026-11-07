/**
 * Is a fact WITHOUT a source id grounded in what the tools returned in this run? Facts about deadlines,
 * availability, progress and drafted plans come from tool results, not pages, so they carry no source id. Without
 * this check any statement could skip the citation check simply by citing nothing (found in the live S2 trace,
 * 7 Nov). Deterministic and conservative, like claimSupport:
 * - at least one data tool must have answered in this run;
 * - every number in the fact must appear in the tool results (also as hours, in the student's local time, or as a
 *   count of returned items);
 * - its content words, apart from common scheduling words, must mostly appear in the tool results.
 * A course-content claim ("a residual equals observed Y minus predicted Y") therefore needs a cited source.
 * Limitation: it checks that the pieces are in the data, not that the sentence combines them correctly.
 */
import { terms } from "@/lib/quiz/cloze";
import { stem } from "@/lib/teach/feedback";

export const TOOL_FACT_THRESHOLD = 0.6;
const key = (word: string) => stem(word).replace(/e$/, "");

// Words a scheduling statement uses that the JSON keys don't spell out (only words of 5+ letters reach terms()).
const SCHEDULING_WORDS = new Set(
  (
    "minute minutes hours hourly weekday weekdays weekend weekends weekly daily deadline deadlines schedule scheduled schedules scheduling " +
    "require required requires requirement estimate estimated estimates shortfall assignment assignments block blocks session sessions " +
    "study studying studies available availability preference preferences timezone remaining remain completed complete progress active " +
    "draft drafted drafts pending approval approve review feasible infeasible recovery scenario balanced essential plans planned planner " +
    "total current currently based leaving leaves short enough overdue coverage percent memory memories saved remembered course courses " +
    "every across today tomorrow tonight morning evening afternoon first second third still needs needed time times spend spent finish " +
    "finished start starts starting submit submitted local january february march april june july august september october november december " +
    "monday tuesday wednesday thursday friday saturday sunday"
  )
    .split(" ")
    .map(key),
);

const numbers = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => n.replace(/\.0+$/, "").replace(/^0+(?=\d)/, ""));

/** Splits camelCase JSON keys ("estimatedMinutes") so their words can match a sentence. */
const words = (s: string) => terms(s.replace(/([a-z])([A-Z])/g, "$1 $2"));

/** Numbers a correct sentence may derive from the data: hours from minutes, local date parts, item counts. */
function derivedNumbers(data: string[]): string[] {
  const out: string[] = [];
  const text = data.join("\n");
  for (const n of numbers(text)) {
    const hours = Number(n) / 60;
    if (Number.isFinite(hours) && hours > 0 && Number.isInteger(hours * 2)) out.push(String(hours));
  }
  const tz = text.match(/"timezone"\s*:\s*"([^"]+)"/)?.[1];
  for (const iso of text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z/g) ?? []) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || !tz) continue;
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date);
      for (const p of parts) if (p.type !== "literal") out.push(...numbers(p.value));
      const hour = Number(parts.find((p) => p.type === "hour")?.value);
      if (Number.isFinite(hour)) out.push(String(hour % 12 === 0 ? 12 : hour % 12));
    } catch {
      // Unknown timezone name: UTC parts are already in the text.
    }
  }
  for (const chunk of data) {
    const json = chunk.slice(chunk.indexOf("\n") + 1);
    try {
      const parsed: unknown = JSON.parse(json.trim().startsWith("[") || json.trim().startsWith("{") ? json : chunk);
      const arrays = Array.isArray(parsed) ? [parsed] : Object.values(parsed as Record<string, unknown>).filter(Array.isArray);
      for (const a of arrays) out.push(String((a as unknown[]).length));
    } catch {
      // Plain-text tool results have no item count.
    }
  }
  return out;
}

export type ToolFactSupport = { supported: boolean; coverage: number; missing: string[]; reason: string };

export function toolFactSupport(statement: string, toolData: string[]): ToolFactSupport {
  if (!toolData.length) return { supported: false, coverage: 0, missing: [], reason: "no tool returned data in this request" };
  const text = toolData.join("\n");
  const known = new Set([...numbers(text), ...derivedNumbers(toolData)]);
  const stray = numbers(statement).filter((n) => !known.has(n));
  if (stray.length) return { supported: false, coverage: 0, missing: stray, reason: `number ${stray[0]} is not in the tool results` };

  const dataStems = new Set(words(text).map(key));
  const content = [...new Set(words(statement).map(key))].filter((t) => !SCHEDULING_WORDS.has(t));
  if (!content.length) return { supported: true, coverage: 1, missing: [], reason: "scheduling statement; numbers match the tool results" };
  const missing = content.filter((t) => !dataStems.has(t));
  const coverage = (content.length - missing.length) / content.length;
  return coverage >= TOOL_FACT_THRESHOLD
    ? { supported: true, coverage, missing, reason: "words and numbers match the tool results" }
    : { supported: false, coverage, missing, reason: "its words are not in the tool results: cite a source for course content" };
}
