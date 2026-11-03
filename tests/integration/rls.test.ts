import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, deleteUser, minimalPdf, signedInUser, type Db } from "./helpers";

let a: { id: string; email: string; db: Db };
let b: { id: string; email: string; db: Db };
let courseA: string;
let assignmentA: string;

const future = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("alice"), signedInUser("bob")]);
  const course = await a.db.from("courses").insert({ title: "Applied Statistics" }).select("id").single();
  if (course.error) throw course.error;
  courseA = course.data.id;
  const assignment = await a.db
    .from("assignments")
    .insert({ course_id: courseA, title: "Regression worksheet", due_at: future(5), estimated_minutes: 240 })
    .select("id")
    .single();
  if (assignment.error) throw assignment.error;
  assignmentA = assignment.data.id;
});

afterAll(async () => {
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("profiles", () => {
  it("are created automatically and only visible to their owner", async () => {
    const own = await a.db.from("profiles").select("id, timezone").eq("id", a.id).single();
    expect(own.data?.timezone).toBe("UTC");
    const other = await b.db.from("profiles").select("id").eq("id", a.id);
    expect(other.data).toEqual([]);
  });

  it("cannot be updated by another student", async () => {
    const res = await b.db.from("profiles").update({ display_name: "hacked" }).eq("id", a.id).select("id");
    expect(res.data).toEqual([]);
    const check = await admin().from("profiles").select("display_name").eq("id", a.id).single();
    expect(check.data?.display_name).toBeNull();
  });

  it("rejects unknown time zones at the database layer", async () => {
    const res = await a.db.from("profiles").update({ timezone: "Mars/Olympus_Mons" }).eq("id", a.id);
    expect(res.error).not.toBeNull();
  });

  it("rejects invalid weekly availability", async () => {
    const res = await a.db.from("profiles").update({ weekly_minutes: [60, 60, 60] }).eq("id", a.id);
    expect(res.error?.code).toBe("23514");
  });
});

describe("courses and assignments isolation", () => {
  it("hides another student's courses and assignments", async () => {
    expect((await b.db.from("courses").select("id").eq("id", courseA)).data).toEqual([]);
    expect((await b.db.from("assignments").select("id").eq("id", assignmentA)).data).toEqual([]);
  });

  it("blocks updates and deletes of another student's rows", async () => {
    const upd = await b.db.from("assignments").update({ title: "pwned" }).eq("id", assignmentA).select("id");
    expect(upd.data).toEqual([]);
    const del = await b.db.from("courses").delete().eq("id", courseA).select("id");
    expect(del.data).toEqual([]);
    const still = await admin().from("assignments").select("title").eq("id", assignmentA).single();
    expect(still.data?.title).toBe("Regression worksheet");
  });

  it("blocks inserting an assignment into another student's course", async () => {
    const res = await b.db.from("assignments").insert({ course_id: courseA, title: "sneaky", due_at: future(2), estimated_minutes: 30 });
    expect(res.error).not.toBeNull();
  });

  it("does not let a student choose owner_id", async () => {
    const res = await b.db.from("courses").insert({ title: "spoof", owner_id: a.id } as never);
    expect(res.error?.code).toBe("42501");
  });

  it("does not let anonymous clients read anything", async () => {
    const res = await anon().from("courses").select("id");
    expect(res.error?.code).toBe("42501");
  });

  it("validates assignment ranges in the database", async () => {
    const res = await a.db.from("assignments").insert({ course_id: courseA, title: "bad", due_at: future(1), estimated_minutes: 0 });
    expect(res.error?.code).toBe("23514");
  });
});

describe("server-owned tables", () => {
  it.each(["document_chunks", "agent_runs", "action_proposals", "study_plans", "study_tasks", "quizzes", "quiz_attempts"] as const)(
    "students cannot insert into %s",
    async (table) => {
      const res = await a.db.from(table).insert({} as never);
      expect(res.error?.code).toBe("42501");
    },
  );

  it("students cannot write a document's server-managed fields", async () => {
    const doc = await a.db.from("documents").insert({ course_id: courseA, filename: "notes.pdf", size_bytes: 1000 }).select("id, storage_path, status").single();
    expect(doc.error).toBeNull();
    expect(doc.data?.storage_path).toBe(`${a.id}/${courseA}/${doc.data?.id}.pdf`);
    const upd = await a.db.from("documents").update({ status: "ready" } as never).eq("id", doc.data!.id);
    expect(upd.error?.code).toBe("42501");
    const spoof = await a.db.from("documents").insert({ course_id: courseA, filename: "x.pdf", size_bytes: 10, storage_path: `${b.id}/x.pdf` } as never);
    expect(spoof.error).not.toBeNull();
  });
});

describe("rate limiting", () => {
  it("counts per student and per window", async () => {
    // An allowlisted bucket these fresh students haven't used (arbitrary buckets are rejected: see abuse.test.ts).
    const bucket = "account";
    const results: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await a.db.rpc("consume_rate_limit", { p_bucket: bucket, p_limit: 2, p_window_seconds: 3600 });
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, false]);
    const other = await b.db.rpc("consume_rate_limit", { p_bucket: bucket, p_limit: 2, p_window_seconds: 3600 });
    expect(other.data).toBe(true);
  });

  it("is not callable anonymously", async () => {
    const res = await anon().rpc("consume_rate_limit", { p_bucket: "x", p_limit: 1, p_window_seconds: 60 });
    expect(res.error).not.toBeNull();
  });
});

describe("private storage", () => {
  let docPath: string;

  beforeAll(async () => {
    const doc = await a.db.from("documents").insert({ course_id: courseA, filename: "module4.pdf", size_bytes: 300 }).select("storage_path").single();
    if (doc.error) throw doc.error;
    docPath = doc.data.storage_path!;
  });

  it("allows uploading only to the exact path of an owned pending document", async () => {
    const ok = await a.db.storage.from("course-documents").upload(docPath, minimalPdf(), { contentType: "application/pdf" });
    expect(ok.error).toBeNull();
    const stray = await a.db.storage.from("course-documents").upload(`${a.id}/${courseA}/random.pdf`, minimalPdf(), { contentType: "application/pdf" });
    expect(stray.error).not.toBeNull();
  });

  it("blocks another student from reading, listing or writing into the folder", async () => {
    const read = await b.db.storage.from("course-documents").download(docPath);
    expect(read.error).not.toBeNull();
    const list = await b.db.storage.from("course-documents").list(`${a.id}/${courseA}`);
    expect(list.data ?? []).toEqual([]);
    const write = await b.db.storage.from("course-documents").upload(`${a.id}/${courseA}/evil.pdf`, minimalPdf(), { contentType: "application/pdf" });
    expect(write.error).not.toBeNull();
    const signed = await b.db.storage.from("course-documents").createSignedUrl(docPath, 60);
    expect(signed.error).not.toBeNull();
  });

  it("rejects non-PDF content types at the bucket", async () => {
    const doc = await a.db.from("documents").insert({ course_id: courseA, filename: "evil.pdf", size_bytes: 10 }).select("storage_path").single();
    const res = await a.db.storage.from("course-documents").upload(doc.data!.storage_path!, new TextEncoder().encode("<html>"), { contentType: "text/html" });
    expect(res.error).not.toBeNull();
  });

  it("lets the owner read their own file", async () => {
    const read = await a.db.storage.from("course-documents").download(docPath);
    expect(read.error).toBeNull();
  });
});
