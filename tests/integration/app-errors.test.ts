import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { GET as errorAlerts } from "@/app/api/cron/error-alerts/route";
import { route } from "@/lib/http/errors";
import { claimNewErrorGroups, listErrorGroups, recordAppError, resolveErrorGroup } from "@/lib/observability/app-errors";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { admin, anon, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let a: User;
let b: User;
const adminDb = () => admin() as unknown as AdminSupabase;
const unique = () => `Probe${Math.random().toString(36).slice(2, 8)}Error`;

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser("errors-a"), signedInUser("errors-b")]);
});
afterAll(async () => {
  await admin().from("app_error_groups").delete().like("error_name", "Probe%");
  await Promise.all([a && deleteUser(a.id), b && deleteUser(b.id)]);
});

describe("self-hosted error tracking", () => {
  it("groups repeats of one failure and stores only redacted text", async () => {
    const name = unique();
    const err = (id: string, email: string) => Object.assign(new Error(`row ${id} failed for ${email} with key AIzaSyA1234567890abcdefghijklmnopqrstuv`), { name });
    const fp1 = await recordAppError({ source: "route", path: `/runs/${a.id}`, error: err(a.id, a.email) }, adminDb());
    const fp2 = await recordAppError({ source: "route", path: `/runs/${b.id}`, error: err(b.id, b.email) }, adminDb());
    expect(fp1).toBe(fp2);
    const { data } = await admin().from("app_error_groups").select("*").eq("fingerprint", fp1!).single();
    expect(data).toMatchObject({ count: 2, path: "/runs/:id", error_name: name, source: "route" });
    const stored = JSON.stringify(data);
    for (const leaked of [a.id, b.id, a.email, b.email, "AIzaSy"]) expect(stored).not.toContain(leaked);
    expect(data!.message).toContain("[email]");
  });

  it("reports each new group to the alert job exactly once, and again if a resolved group comes back", async () => {
    const name = unique();
    const fp = await recordAppError({ source: "agent", path: "/api/agent/run", error: Object.assign(new Error("stream broke"), { name }) }, adminDb());
    const first = await claimNewErrorGroups(adminDb());
    expect(first.map((g) => g.fingerprint)).toContain(fp);
    expect((await claimNewErrorGroups(adminDb())).map((g) => g.fingerprint)).not.toContain(fp);
    await resolveErrorGroup(adminDb(), fp!);
    expect((await listErrorGroups(adminDb())).map((g) => g.fingerprint)).not.toContain(fp);
    await recordAppError({ source: "agent", path: "/api/agent/run", error: Object.assign(new Error("stream broke"), { name }) }, adminDb());
    const again = await claimNewErrorGroups(adminDb());
    expect(again.find((g) => g.fingerprint === fp)).toMatchObject({ count: 2, resolvedAt: null });
  });

  it("students and anonymous callers can neither read nor write error groups (both students checked)", async () => {
    await recordAppError({ source: "route", path: "/api/x", error: Object.assign(new Error("hidden"), { name: unique() }) }, adminDb());
    for (const db of [a.db, b.db, anon()]) {
      const read = await db.from("app_error_groups").select("fingerprint").limit(5);
      expect(read.data ?? []).toEqual([]);
      const insert = await db.from("app_error_groups").insert({ fingerprint: "0123456789abcdef", source: "route", path: "/x", error_name: "X", message: "forged" });
      expect(insert.error).not.toBeNull();
      const rpc = await db.rpc("record_app_error", { p_fingerprint: "0123456789abcdef", p_source: "route", p_path: "/x", p_name: "X", p_message: "forged", p_stack: "", p_release: "" });
      expect(rpc.error).not.toBeNull();
    }
    const { data } = await admin().from("app_error_groups").select("fingerprint").eq("fingerprint", "0123456789abcdef");
    expect(data).toEqual([]);
  });

  it("the alert endpoint refuses callers without the cron secret and returns new groups once", async () => {
    const secret = "test-cron-secret-0123456789abcdefghijkl";
    vi.stubEnv("CRON_SECRET", secret);
    try {
      expect((await errorAlerts(new Request("http://localhost/api/cron/error-alerts"))).status).toBe(403);
      expect((await errorAlerts(new Request("http://localhost/api/cron/error-alerts", { headers: { authorization: "Bearer wrong-secret-0123456789abcdefghijkl" } }))).status).toBe(403);
      await claimNewErrorGroups(adminDb()); // start from a clean slate
      const name = unique();
      await recordAppError({ source: "boundary", path: "/insights", error: Object.assign(new Error(`chart failed for ${a.email}`), { name }) }, adminDb());
      const call = () => errorAlerts(new Request("http://localhost/api/cron/error-alerts", { headers: { authorization: `Bearer ${secret}` } }));
      const first = await (await call()).json();
      expect(first.newGroups).toEqual([expect.objectContaining({ source: "boundary", path: "/insights", name, count: 1 })]);
      expect(JSON.stringify(first)).not.toContain(a.email);
      expect((await (await call()).json()).newGroups).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("every API route's unexpected 500 is recorded; expected 4xx errors are not", async () => {
    const name = unique();
    const crash = route(async (req: Request) => {
      void req;
      throw Object.assign(new Error(`db exploded for ${a.email}`), { name });
    });
    const res = await crash(new Request(`http://localhost/api/courses/${a.id}`, { method: "POST" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("exploded"); // the student never sees internals
    const { data } = await admin().from("app_error_groups").select("source, path, error_name, message").eq("error_name", name).single();
    expect(data).toMatchObject({ source: "route", path: "/api/courses/:id" });
    expect(data!.message).not.toContain(a.email);

    const { ApiError } = await import("@/lib/http/errors");
    const notFound = route(async (req: Request) => {
      void req;
      throw new ApiError(404, "not_found", `Probe404 ${name}`);
    });
    expect((await notFound(new Request("http://localhost/api/x"))).status).toBe(404);
    const { count } = await admin().from("app_error_groups").select("fingerprint", { count: "exact", head: true }).like("message", `%Probe404 ${name}%`);
    expect(count).toBe(0);
  });

  it("never throws, even when the database refuses the write", async () => {
    await expect(recordAppError({ source: "route", path: "/x", error: new Error("x") }, anon() as unknown as AdminSupabase)).resolves.toMatch(/^[0-9a-f]{16}$/);
  });
});
