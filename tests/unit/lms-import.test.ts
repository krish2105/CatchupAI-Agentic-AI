import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { csvRows, parseCsv, parseIcs, parseImscc, parseLmsFile, readZip } from "@/lib/import/lms";

const TZ = "Asia/Dubai";

/** Builds a ZIP (deflate or stored entries) the way LMS exports are packaged. */
function zip(files: Record<string, string>, method: 0 | 8 = 8) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text);
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(method, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(method, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

describe("ICS (Canvas, Moodle, Google Classroom)", () => {
  it("reads Canvas events: course in brackets, UTC times, folded lines and escapes", () => {
    const ics = [
      "BEGIN:VCALENDAR", "X-WR-CALNAME:Canvas calendar",
      "BEGIN:VEVENT", "UID:event-assignment-1", "DTSTART:20261120T195900Z", "SUMMARY:Regression worksheet\\, part 2 [Applied Statistics]", "END:VEVENT",
      "BEGIN:VEVENT", "UID:event-assignment-2", "DTSTART;VALUE=DATE:20261127", "SUMMARY:Midterm exam [Applied Sta", " tistics]", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const r = parseIcs(ics, { timezone: TZ });
    expect(r.candidates).toEqual([
      expect.objectContaining({ courseTitle: "Applied Statistics", title: "Regression worksheet, part 2", dueAt: "2026-11-20T19:59:00.000Z", assumptions: [] }),
      expect.objectContaining({ courseTitle: "Applied Statistics", title: "Midterm exam", dueAt: "2026-11-27T19:59:00.000Z", assumptions: ["No time given: set to 23:59"] }),
    ]);
    expect(r.candidates[1].estimatedMinutes).toBe(360); // same estimate rules as the syllabus import
  });

  it("reads Moodle (CATEGORIES, TZID, 'is due') and Google Classroom (calendar name) exports", () => {
    const moodle = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:42@moodle\nSUMMARY:Lab report is due\nCATEGORIES:CHEM101\nDTSTART;TZID=Asia/Dubai:20261118T170000\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseIcs(moodle, { timezone: "UTC" }).candidates[0]).toMatchObject({ courseTitle: "CHEM101", title: "Lab report", dueAt: "2026-11-18T13:00:00.000Z", assumptions: [] });
    const classroom = "BEGIN:VCALENDAR\nX-WR-CALNAME:Biology 10A\nBEGIN:VEVENT\nSUMMARY:Cell diagram\nDTSTART:20261119T090000\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseIcs(classroom, { timezone: TZ }).candidates[0]).toMatchObject({ courseTitle: "Biology 10A", title: "Cell diagram", dueAt: "2026-11-19T05:00:00.000Z", assumptions: ["No time zone in the file: read as Asia/Dubai"] });
  });

  it("skips events without a title or a readable date and counts them", () => {
    const r = parseIcs("BEGIN:VEVENT\nSUMMARY:No date\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:2026\nSUMMARY:Bad\nEND:VEVENT", { timezone: TZ });
    expect(r.candidates).toEqual([]);
    expect(r.skipped).toEqual([{ reason: "no title or date", count: 2 }]);
  });
});

describe("CSV", () => {
  it("parses quoted fields, finds columns by header and reads hours or minutes", () => {
    const csv = 'Course,Assignment,Due date,Hours\n"Stats, Fall",Worksheet "A",2026-11-20 16:00,2.5\nChem,Lab,20/11/2026,\n';
    expect(csvRows(csv)[1]).toEqual(["Stats, Fall", "Worksheet A", "2026-11-20 16:00", "2.5"]);
    const r = parseCsv(csv, { timezone: TZ });
    expect(r.candidates[0]).toMatchObject({ courseTitle: "Stats, Fall", dueAt: "2026-11-20T12:00:00.000Z", estimatedMinutes: 150, source: "row 2" });
    expect(r.candidates[1]).toMatchObject({ courseTitle: "Chem", title: "Lab", dueAt: "2026-11-20T19:59:00.000Z", estimatedMinutes: 120 });
    expect(r.candidates[1].assumptions).toContain("No time given: set to 23:59");
  });

  it("flags ambiguous day/month dates and accepts semicolon files", () => {
    const r = parseCsv("title;due\nEssay;03/04/2027 10:00\nQuiz;04/13/2027\n", { timezone: "UTC", defaultCourse: "History" });
    expect(r.candidates[0]).toMatchObject({ courseTitle: "History", dueAt: "2027-04-03T10:00:00.000Z" });
    expect(r.candidates[0].assumptions).toContain("Read as day/month");
    expect(r.candidates[1]).toMatchObject({ dueAt: "2027-04-13T23:59:00.000Z" });
    expect(r.candidates[1].assumptions).toContain("Read as month/day");
  });

  it("explains a header it can't use and skips unreadable rows", () => {
    expect(parseCsv("foo,bar\n1,2", { timezone: TZ }).skipped[0].reason).toBe("no title and due columns in the header");
    expect(parseCsv("title,due\nA,soon\nB,2026-13-40", { timezone: TZ }).skipped).toEqual([{ reason: "rows without a title or a readable date", count: 2 }]);
  });
});

describe("IMSCC / Canvas course export", () => {
  const manifest = `<?xml version="1.0"?><manifest><metadata><lom><general><title><string>Applied Statistics (Fall 2026)</string></title></general></lom></metadata></manifest>`;
  const assignment = (title: string, due?: string) => `<assignment><title>${title}</title>${due ? `<due_at>${due}</due_at>` : ""}<points_possible>10</points_possible></assignment>`;

  it("reads the course title and every dated assignment (deflate and stored entries)", async () => {
    for (const method of [8, 0] as const) {
      const bytes = zip({ "imsmanifest.xml": manifest, "g1/assignment_settings.xml": assignment("Regression &amp; residuals", "2026-11-20T19:59:00"), "g2/assignment_settings.xml": assignment("Reading log"), "g2/notes.html": "<p>ignored</p>" }, method);
      const r = await parseImscc(bytes);
      expect(r.candidates).toEqual([expect.objectContaining({ courseTitle: "Applied Statistics (Fall 2026)", title: "Regression & residuals", dueAt: "2026-11-20T19:59:00.000Z", assumptions: ["Canvas export time read as UTC"] })]);
      expect(r.skipped).toEqual([{ reason: "assignments without a due date", count: 1 }]);
    }
  });

  it("prefers the Canvas course_settings title and keeps explicit offsets", async () => {
    const bytes = zip({ "imsmanifest.xml": manifest, "course_settings/course_settings.xml": "<course><title>STAT 201</title></course>", "a/assignment_settings.xml": assignment("Quiz 1", "2026-11-12T16:00:00+04:00") });
    expect((await parseImscc(bytes)).candidates[0]).toMatchObject({ courseTitle: "STAT 201", dueAt: "2026-11-12T12:00:00.000Z", assumptions: [] });
  });

  it("reads only the files it needs and rejects non-ZIP input", async () => {
    const files = await readZip(zip({ "a.txt": "x", "imsmanifest.xml": manifest }), (n) => n === "imsmanifest.xml");
    expect([...files.keys()]).toEqual(["imsmanifest.xml"]);
    await expect(parseImscc(new TextEncoder().encode("not a zip"))).rejects.toThrow(/isn't a ZIP/);
  });
});

describe("file type detection", () => {
  it("routes by content and extension and refuses other files", async () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect((await parseLmsFile({ name: "calendar.txt", bytes: enc("BEGIN:VCALENDAR\nEND:VCALENDAR") }, { timezone: TZ })).format).toBe("ics");
    expect((await parseLmsFile({ name: "deadlines.csv", bytes: enc("title,due\nA,2026-11-20") }, { timezone: TZ })).candidates[0].courseTitle).toBe("deadlines");
    expect((await parseLmsFile({ name: "course.imscc", bytes: zip({ "imsmanifest.xml": "<manifest/>" }) }, { timezone: TZ })).format).toBe("imscc");
    await expect(parseLmsFile({ name: "notes.pdf", bytes: enc("%PDF") }, { timezone: TZ })).rejects.toThrow(/\.ics/);
  });
});
