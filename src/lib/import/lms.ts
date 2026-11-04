/**
 * LMS export import (pure, client-safe, no AI). Reads deadlines from the files students can download from their
 * learning platform and returns CANDIDATES for review; nothing is saved here.
 *  - ICS calendar exports and feeds: Canvas ("Title [Course]"), Moodle (CATEGORIES = course, "… is due"),
 *    Google Classroom (one calendar per class: X-WR-CALNAME).
 *  - CSV: a header row with a title and a due column (course and minutes/hours optional).
 *  - IMSCC / Canvas course export (.imscc, .zip): course title from the manifest or course settings, and every
 *    assignment that has a due date (assignment_settings.xml).
 * Times without a zone are read in the student's time zone and flagged; dates without a time become 23:59.
 */
import { TZDate } from "@date-fns/tz";
import { estimateMinutes } from "@/lib/syllabus/extract";

export type ImportCandidate = {
  courseTitle: string;
  title: string;
  dueAt: string;
  estimatedMinutes: number;
  /** Where it came from in the file (event UID, CSV row, cartridge path). */
  source: string;
  assumptions: string[];
};
export type ImportResult = { format: "ics" | "csv" | "imscc"; candidates: ImportCandidate[]; skipped: { reason: string; count: number }[] };

export const IMPORT_LIMITS = { maxFileBytes: 20 * 1024 * 1024, maxItems: 500, maxEntryBytes: 5 * 1024 * 1024, maxZipEntries: 5000 } as const;

const clean = (s: string, max = 200) => s.replace(/\s+/g, " ").trim().slice(0, max);

type Parts = { y: number; mo: number; d: number; h: number; mi: number };
/** An instant from wall-clock parts in a time zone (TZDate handles DST). */
function zoned(p: Parts, timezone: string) {
  return new Date(new TZDate(p.y, p.mo - 1, p.d, p.h, p.mi, 0, timezone).getTime()).toISOString();
}
function validParts(p: Parts) {
  return p.mo >= 1 && p.mo <= 12 && p.d >= 1 && p.d <= 31 && p.h <= 23 && p.mi <= 59 && p.y >= 2000 && p.y <= 2100;
}

/* ---------------------------------- ICS ---------------------------------- */

function unfold(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}
const unescapeIcs = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");

type IcsLine = { name: string; params: Record<string, string>; value: string };
function parseLine(line: string): IcsLine | null {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const [name, ...params] = line.slice(0, colon).split(";");
  return { name: name.toUpperCase(), params: Object.fromEntries(params.map((p) => { const [k, ...v] = p.split("="); return [k.toUpperCase(), v.join("=").replace(/^"|"$/g, "")]; })), value: line.slice(colon + 1) };
}

/** DTSTART/DUE value → ISO instant, with any assumption made. */
function icsDate(line: IcsLine, timezone: string): { iso: string; assumptions: string[] } | null {
  const m = line.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const p: Parts = { y: +m[1], mo: +m[2], d: +m[3], h: m[4] ? +m[4] : 23, mi: m[5] ? +m[5] : 59 };
  if (!validParts(p)) return null;
  if (!m[4]) return { iso: zoned(p, timezone), assumptions: ["No time given: set to 23:59"] };
  if (m[7]) return { iso: new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi)).toISOString(), assumptions: [] };
  const tzid = line.params.TZID;
  if (tzid) {
    try {
      return { iso: zoned(p, tzid), assumptions: [] };
    } catch {
      /* unknown TZID: fall through to the student's zone */
    }
  }
  return { iso: zoned(p, timezone), assumptions: [`No time zone in the file: read as ${timezone}`] };
}

export function parseIcs(text: string, opts: { timezone: string }): ImportResult {
  const lines = unfold(text).split("\n");
  const calName = lines.map(parseLine).find((l) => l?.name === "X-WR-CALNAME")?.value;
  const candidates: ImportCandidate[] = [];
  let noDate = 0;
  let event: IcsLine[] | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^BEGIN:(VEVENT|VTODO)$/i.test(line)) event = [];
    else if (/^END:(VEVENT|VTODO)$/i.test(line) && event) {
      const get = (n: string) => event!.find((l) => l.name === n);
      const summary = clean(unescapeIcs(get("SUMMARY")?.value ?? ""));
      const when = get("DUE") ?? get("DTSTART");
      const date = when ? icsDate(when, opts.timezone) : null;
      if (!summary || !date) noDate++;
      else {
        // Canvas: "Essay draft [ENG 101]"; Moodle: CATEGORIES; Google Classroom: one calendar per class.
        const bracket = summary.match(/^(.*\S)\s*\[([^\]]{1,120})\]$/);
        const categories = get("CATEGORIES")?.value;
        const courseTitle = clean(bracket?.[2] ?? (categories ? unescapeIcs(categories.split(",")[0]) : calName ? unescapeIcs(calName) : "Imported course"), 120);
        const title = clean((bracket?.[1] ?? summary).replace(/\s+(is due|closes|opens|due)$/i, ""));
        candidates.push({ courseTitle, title, dueAt: date.iso, estimatedMinutes: estimateMinutes(title), source: `event ${clean(get("UID")?.value ?? String(candidates.length + 1), 80)}`, assumptions: date.assumptions });
      }
      event = null;
    } else if (event) {
      const parsed = parseLine(line);
      if (parsed) event.push(parsed);
    }
  }
  return { format: "ics", candidates: candidates.slice(0, IMPORT_LIMITS.maxItems), skipped: [...(noDate ? [{ reason: "no title or date", count: noDate }] : []), ...overLimit(candidates.length)] };
}

const overLimit = (n: number) => (n > IMPORT_LIMITS.maxItems ? [{ reason: `more than ${IMPORT_LIMITS.maxItems} items`, count: n - IMPORT_LIMITS.maxItems }] : []);

/* ---------------------------------- CSV ---------------------------------- */

/** RFC 4180-style rows: quoted fields, doubled quotes, commas, semicolons or tabs (whichever the header uses). */
export function csvRows(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const header = body.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => header.split(b).length - header.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const COLUMNS = {
  title: /^(title|name|assignment|assignment name|task|item)$/i,
  course: /^(course|class|course name|module|subject)$/i,
  due: /^(due|due date|due at|deadline|due date \(.*\)|date)$/i,
  minutes: /^(minutes|estimated minutes|estimate \(min\)|duration)$/i,
  hours: /^(hours|estimated hours|estimate \(h\))$/i,
};

/** A CSV date cell: ISO (with or without zone), "YYYY-MM-DD HH:MM", or D/M/YYYY (flagged when ambiguous). */
function csvDate(cell: string, timezone: string): { iso: string; assumptions: string[] } | null {
  const v = cell.trim();
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : { iso: new Date(t).toISOString(), assumptions: [] };
  }
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/);
  let p: Parts | null = m ? { y: +m[1], mo: +m[2], d: +m[3], h: m[4] ? +m[4] : 23, mi: m[5] ? +m[5] : 59 } : null;
  const notes: string[] = [];
  if (!p) {
    m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (m) {
      const a = +m[1];
      const b = +m[2];
      const monthFirst = b > 12 && a <= 12;
      p = { y: +m[3], mo: monthFirst ? a : b, d: monthFirst ? b : a, h: m[4] ? +m[4] : 23, mi: m[5] ? +m[5] : 59 };
      if (a <= 12 && b <= 12) notes.push("Read as day/month");
      if (monthFirst) notes.push("Read as month/day");
    }
  }
  if (!p || !validParts(p)) return null;
  if (!m?.[4]) notes.push("No time given: set to 23:59");
  else notes.push(`Read in ${timezone}`);
  return { iso: zoned(p, timezone), assumptions: notes };
}

export function parseCsv(text: string, opts: { timezone: string; defaultCourse?: string }): ImportResult {
  const [header, ...rows] = csvRows(text);
  if (!header) return { format: "csv", candidates: [], skipped: [] };
  const col = (re: RegExp) => header.findIndex((h) => re.test(h.trim()));
  const at = { title: col(COLUMNS.title), course: col(COLUMNS.course), due: col(COLUMNS.due), minutes: col(COLUMNS.minutes), hours: col(COLUMNS.hours) };
  if (at.title < 0 || at.due < 0) return { format: "csv", candidates: [], skipped: [{ reason: "no title and due columns in the header", count: rows.length }] };
  const candidates: ImportCandidate[] = [];
  let bad = 0;
  rows.forEach((r, i) => {
    const title = clean(r[at.title] ?? "");
    const date = csvDate(r[at.due] ?? "", opts.timezone);
    if (!title || !date) return void bad++;
    const minutes = at.minutes >= 0 ? Number(r[at.minutes]) : at.hours >= 0 ? Number(r[at.hours]) * 60 : NaN;
    candidates.push({
      courseTitle: clean((at.course >= 0 ? r[at.course] : "") || opts.defaultCourse || "Imported course", 120),
      title,
      dueAt: date.iso,
      estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(9600, Math.round(minutes)) : estimateMinutes(title),
      source: `row ${i + 2}`,
      assumptions: date.assumptions,
    });
  });
  return { format: "csv", candidates: candidates.slice(0, IMPORT_LIMITS.maxItems), skipped: [...(bad ? [{ reason: "rows without a title or a readable date", count: bad }] : []), ...overLimit(candidates.length)] };
}

/* --------------------------------- IMSCC --------------------------------- */

/** Minimal ZIP reader (central directory; stored or deflate entries) with size limits against zip bombs. */
export async function readZip(bytes: Uint8Array, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This file isn't a ZIP or IMSCC package.");
  const entries = Math.min(view.getUint16(eocd + 10, true), IMPORT_LIMITS.maxZipEntries);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  const decoder = new TextDecoder();
  for (let n = 0; n < entries && p + 46 <= bytes.length && view.getUint32(p, true) === 0x02014b50; n++) {
    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extra = view.getUint16(p + 30, true);
    const comment = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extra + comment;
    if (!wanted(name) || size > IMPORT_LIMITS.maxEntryBytes || local + 30 > bytes.length) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + compressed);
    if (method === 0) out.set(name, decoder.decode(data));
    else if (method === 8) {
      const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
      if (inflated.byteLength <= IMPORT_LIMITS.maxEntryBytes) out.set(name, decoder.decode(inflated));
    }
  }
  return out;
}

const xmlText = (xml: string, tag: string) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return m ? clean(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")) : null;
};

/** Canvas exports store due_at in UTC without a zone, so the student's time zone is not used here (the row is flagged). */
export async function parseImscc(bytes: Uint8Array): Promise<ImportResult> {
  const files = await readZip(bytes, (n) => /(^|\/)(imsmanifest\.xml|course_settings\.xml|assignment_settings\.xml)$/i.test(n));
  const manifest = files.get("imsmanifest.xml") ?? "";
  const settings = [...files.entries()].find(([n]) => /course_settings\.xml$/i.test(n))?.[1] ?? "";
  // Manifest title: <lomimscc:title><lomimscc:string>…</lomimscc:string></lomimscc:title>
  const courseTitle = xmlText(settings, "title") ?? xmlText(manifest.match(/<(?:\w+:)?title\b[\s\S]*?<\/(?:\w+:)?title>/i)?.[0] ?? "", "string") ?? "Imported course";
  const candidates: ImportCandidate[] = [];
  let undated = 0;
  for (const [name, xml] of files) {
    if (!/assignment_settings\.xml$/i.test(name)) continue;
    const title = xmlText(xml, "title");
    const due = xmlText(xml, "due_at");
    if (!title || !due) {
      undated++;
      continue;
    }
    const zone = /(Z|[+-]\d{2}:?\d{2})$/.test(due);
    const parsed = zone ? Date.parse(due) : Date.parse(`${due}Z`);
    if (Number.isNaN(parsed)) {
      undated++;
      continue;
    }
    candidates.push({ courseTitle: clean(courseTitle, 120), title: clean(title), dueAt: new Date(parsed).toISOString(), estimatedMinutes: estimateMinutes(title), source: name.split("/")[0], assumptions: zone ? [] : ["Canvas export time read as UTC"] });
  }
  return { format: "imscc", candidates: candidates.slice(0, IMPORT_LIMITS.maxItems), skipped: [...(undated ? [{ reason: "assignments without a due date", count: undated }] : []), ...overLimit(candidates.length)] };
}

/** Picks the parser from the file name and content. */
export async function parseLmsFile(file: { name: string; bytes: Uint8Array }, opts: { timezone: string }): Promise<ImportResult> {
  if (file.bytes.byteLength > IMPORT_LIMITS.maxFileBytes) throw new Error("This file is larger than 20 MB.");
  const name = file.name.toLowerCase();
  const isZip = file.bytes[0] === 0x50 && file.bytes[1] === 0x4b;
  if (isZip || name.endsWith(".imscc") || name.endsWith(".zip")) return parseImscc(file.bytes);
  const text = new TextDecoder().decode(file.bytes);
  if (name.endsWith(".ics") || /^\s*BEGIN:VCALENDAR/i.test(text)) return parseIcs(text, opts);
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) return parseCsv(text, { ...opts, defaultCourse: file.name.replace(/\.[^.]+$/, "") });
  throw new Error("Use an .ics calendar export, a .csv file or an .imscc course export.");
}
