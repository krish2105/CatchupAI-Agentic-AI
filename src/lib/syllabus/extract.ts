import { TZDate } from "@date-fns/tz";

/**
 * Deterministic syllabus deadline extraction (no AI). Finds lines that mention graded work AND a date,
 * converts the date to an instant in the student's time zone, and returns CANDIDATES for the student to
 * review. Nothing is saved by this module.
 */
export type SyllabusCandidate = {
  title: string;
  dueAt: string;
  estimatedMinutes: number;
  page: number;
  sourceText: string;
  assumptions: string[];
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const WORK = /\b(assignment|homework|hw|quiz|exam|midterm|mid-term|final|project|report|essay|lab|presentation|worksheet|test|submission|deliverable|paper|due|deadline)\b/i;

const ESTIMATES: [RegExp, number][] = [
  [/\b(final|exam|midterm|mid-term)\b/i, 360],
  [/\bproject\b/i, 480],
  [/\b(report|essay|paper)\b/i, 300],
  [/\bpresentation\b/i, 180],
  [/\b(quiz|test)\b/i, 90],
  [/\blab\b/i, 120],
];

/** Starting estimate in minutes for a piece of graded work, from words in its title (shared with the LMS import). */
export const estimateMinutes = (text: string) => ESTIMATES.find(([r]) => r.test(text))?.[1] ?? 180;

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray) => { y?: number; mo: number; d: number; note?: string } | null }[] = [
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/, parse: (m) => ({ y: +m[1], mo: +m[2] - 1, d: +m[3] }) },
  {
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES})\\.?,?(?:\\s+(\\d{4}))?\\b`, "i"),
    parse: (m) => ({ d: +m[1], mo: MONTHS[m[2].toLowerCase()], y: m[3] ? +m[3] : undefined }),
  },
  {
    re: new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?(?:\\s+(\\d{4}))?\\b`, "i"),
    parse: (m) => ({ mo: MONTHS[m[1].toLowerCase()], d: +m[2], y: m[3] ? +m[3] : undefined }),
  },
  {
    re: /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/,
    parse: (m) => {
      const a = +m[1];
      const b = +m[2];
      if (a > 12 && b <= 12) return { d: a, mo: b - 1, y: +m[3] };
      if (b > 12 && a <= 12) return { d: b, mo: a - 1, y: +m[3], note: "Read as month/day" };
      return { d: a, mo: b - 1, y: +m[3], note: "Read as day/month" };
    },
  },
];

const TIME = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/i;

function cleanTitle(text: string, removed: string[]) {
  let t = text;
  for (const r of removed) if (r) t = t.replace(r, " ");
  t = t.replace(/\(\s*\)/g, "").replace(/^\s*[-–—•·*:,;]+\s*/, "").replace(/\s{2,}/g, " ").trim();
  // Strip trailing connectors ("— due ,", "by", "deadline:") until nothing changes.
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(/\s*[.,;:–—-]\s*$/, "").replace(/\s*\b(due|deadline|on|by|at|submit(?:ted)?)\b\s*$/i, "").trim();
  }
  return t.slice(0, 120);
}

export function extractSyllabusDeadlines(pages: string[], opts: { timezone: string; now: number }): SyllabusCandidate[] {
  const out: SyllabusCandidate[] = [];
  const seen = new Set<string>();
  const nowLocal = new TZDate(opts.now, opts.timezone);
  pages.forEach((text, pageIndex) => {
    // Re-join lines that a PDF wrapped mid-sentence (the next line starts lowercase, with a digit or "(").
    const unwrapped = text.replace(/\n(?=[a-z0-9(])/g, " ");
    for (const raw of unwrapped.split(/\n|(?<=[.;])\s+(?=[A-Z])/)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (line.length < 6 || line.length > 300 || !WORK.test(line)) continue;
      for (const { re, parse } of PATTERNS) {
        const m = line.match(re);
        if (!m) continue;
        const parts = parse(m);
        if (!parts || parts.mo < 0 || parts.mo > 11 || parts.d < 1 || parts.d > 31) continue;
        const assumptions: string[] = [];
        if (parts.note) assumptions.push(parts.note);
        let year = parts.y;
        if (!year) {
          // No year: the next occurrence on or after ~1 month ago.
          year = nowLocal.getFullYear();
          if (new TZDate(year, parts.mo, parts.d, 23, 59, 0, opts.timezone).getTime() < opts.now - 30 * 86400_000) year += 1;
          assumptions.push(`Year assumed ${year}`);
        }
        const t = line.match(TIME);
        let h = 23;
        let min = 59;
        if (t) {
          if (t[3]) {
            h = (+t[1] % 12) + (t[3].toLowerCase() === "pm" ? 12 : 0);
            min = t[2] ? +t[2] : 0;
          } else {
            h = +t[4];
            min = +t[5];
          }
        } else assumptions.push("No time given: 23:59 assumed");
        const due = new TZDate(year, parts.mo, parts.d, h, min, 0, opts.timezone);
        if (due.getMonth() !== parts.mo) continue; // e.g. 31 Nov
        const title = cleanTitle(line, [m[0], t?.[0] ?? ""]) || "Untitled deadline";
        const estimate = estimateMinutes(line);
        const dueAt = new Date(due.getTime()).toISOString();
        const k = `${title.toLowerCase()}|${dueAt}`;
        if (seen.has(k)) break;
        seen.add(k);
        out.push({ title, dueAt, estimatedMinutes: estimate, page: pageIndex + 1, sourceText: line.slice(0, 240), assumptions });
        break;
      }
    }
  });
  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
