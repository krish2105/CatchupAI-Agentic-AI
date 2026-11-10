/**
 * Reads the copilot's structured answer while it is still being streamed as JSON text
 * (`{"facts":[...],"suggestions":[...],"clarifyingQuestion":...}`).
 *
 * - `facts` contains only fact objects that are complete. The caller still verifies each one against the
 *   retrieved sources before showing it, so a half-written or unsupported fact is never displayed.
 * - `suggestions` and `clarifyingQuestion` may end in a partly written string: they are advice, and
 *   showing them word by word is the point of streaming.
 *
 * The scan keeps a stack of open containers and remembers the last point where the text was valid JSON
 * once closed. Pure and dependency-free so it can be unit-tested and used on either side.
 */
export type PartialFact = { statement: string; sourceIds: string[] };
/** midString: the text ends inside a string value (the last suggestion/question is still being written). */
export type PartialAnswer = { scope: "catchup" | "out_of_scope" | null; facts: PartialFact[]; suggestions: string[]; clarifyingQuestion: string | null; midString: boolean };

type Frame = { kind: "{" | "["; key: string | null; phase: "key" | "colon" | "value" | "comma"; lastKey: string | null };

const clone = (stack: Frame[]) => stack.map((f) => ({ ...f }));
const closers = (stack: Frame[]) => stack.map((f) => (f.kind === "{" ? "}" : "]")).reverse().join("");

export function parsePartialAnswer(text: string): PartialAnswer | null {
  const stack: Frame[] = [];
  let inString = false;
  let stringIsKey = false;
  let stringStart = 0;
  let escape = false;
  let cut = 0;
  let cutStack: Frame[] = [];
  let started = false;

  const valueDone = (end: number) => {
    const top = stack.at(-1);
    if (top) top.phase = "comma";
    cut = end;
    cutStack = clone(stack);
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') {
        inString = false;
        if (stringIsKey) {
          const top = stack.at(-1)!;
          top.lastKey = JSON.parse(text.slice(stringStart, i + 1)) as string;
          top.phase = "colon";
        } else valueDone(i + 1);
      }
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (!started) {
      if (ch !== "{") return null; // not a JSON object answer
      started = true;
    }
    const top = stack.at(-1);
    if (ch === "{" || ch === "[") {
      stack.push({ kind: ch, key: top?.kind === "{" ? top.lastKey : null, phase: ch === "{" ? "key" : "value", lastKey: null });
      cut = i + 1;
      cutStack = clone(stack);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length) valueDone(i + 1);
      else {
        cut = i + 1;
        cutStack = [];
        break; // the answer object is complete
      }
    } else if (ch === '"') {
      inString = true;
      stringIsKey = top?.kind === "{" && top.phase === "key";
      stringStart = i;
    } else if (ch === ":") {
      if (top) top.phase = "value";
    } else if (ch === ",") {
      if (top) top.phase = top.kind === "{" ? "key" : "value";
    } else {
      // A literal (number, true, false, null): complete once a delimiter follows.
      let j = i;
      while (j < text.length && !/[\s,\]}]/.test(text[j])) j++;
      if (j >= text.length) break;
      valueDone(j);
      i = j - 1;
    }
  }
  if (!started) return null;

  let repaired: string;
  let state: Frame[];
  if (inString && !stringIsKey) {
    // Keep the partly written string value; drop a dangling escape so it still parses.
    const body = escape ? text.slice(0, -1) : text.replace(/\\u[0-9a-fA-F]{0,3}$/, "");
    repaired = `${body}"${closers(stack)}`;
    state = stack;
  } else {
    repaired = text.slice(0, cut) + closers(cutStack);
    state = cutStack;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(repaired);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;

  const rawFacts = Array.isArray(obj.facts) ? obj.facts : [];
  // While the facts array is still open, its last element may be cut short: hold it back.
  const factsOpen = state.length >= 2 && state[1].kind === "[" && state[1].key === "facts";
  const lastIncomplete = factsOpen && state.length >= 3;
  const facts = (lastIncomplete ? rawFacts.slice(0, -1) : rawFacts).filter(
    (f): f is PartialFact =>
      Boolean(f) && typeof (f as PartialFact).statement === "string" && Array.isArray((f as PartialFact).sourceIds) && (f as PartialFact).sourceIds.every((s) => typeof s === "string"),
  );
  const suggestions = Array.isArray(obj.suggestions) ? obj.suggestions.filter((s): s is string => typeof s === "string") : [];
  const clarifyingQuestion = typeof obj.clarifyingQuestion === "string" ? obj.clarifyingQuestion : null;
  // Only a complete, known value counts (a half-written "out_of_sc" is not a scope yet).
  const scope = obj.scope === "catchup" || obj.scope === "out_of_scope" ? obj.scope : null;
  return { scope, facts, suggestions, clarifyingQuestion, midString: inString && !stringIsKey };
}
