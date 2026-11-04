import "server-only";
import { z } from "zod";
import { ApiError, fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * Organisations (institutions/classes). Every write is a database function that checks the caller's role
 * (supabase/migrations/…18_organizations.sql); this module only maps their errors to clear messages. Staff see
 * a roster (name, role, sharing) and class aggregates from consenting students, never anyone's study data.
 */
export const orgName = z.object({ name: z.string().trim().min(2).max(120) }).strict();
export const joinCode = z.object({ code: z.string().trim().regex(/^[A-Za-z0-9]{10}$/, "A join code has 10 letters and digits.") }).strict();
export const shareBody = z.object({ share: z.boolean() }).strict();
export const roleBody = z.object({ userId: z.uuid(), role: z.enum(["student", "teacher", "admin"]) }).strict();

function rpcError(error: { code?: string; message?: string }): ApiError {
  if (error.code === "P0002") return new ApiError(404, "not_found", error.message === "invalid join code" ? "That code doesn't match an organisation." : "Not found.");
  if (error.code === "23514") return new ApiError(409, "conflict", error.message === "make another member admin before leaving" ? "Make another member an admin before you leave." : error.message === "an organisation needs an admin" ? "An organisation needs at least one admin." : "You've reached the limit of 5 organisations.");
  if (error.code === "42501") return new ApiError(403, "forbidden", /demo accounts/.test(error.message ?? "") ? "Demo accounts can't join organisations. Sign in with your email first." : "You don't have access to that.");
  return fromDbError(error);
}

async function call<T>(p: PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw rpcError(error);
  return data;
}

export const createOrganization = (s: ServerSupabase, name: string) => call(s.rpc("create_organization", { p_name: name }));
export const joinOrganization = (s: ServerSupabase, code: string) => call(s.rpc("join_organization", { p_code: code }));
export const setShareProgress = (s: ServerSupabase, org: string, share: boolean) => call(s.rpc("set_share_progress", { p_org: org, p_share: share }));
export const leaveOrganization = (s: ServerSupabase, org: string) => call(s.rpc("leave_organization", { p_org: org }));
export const setMemberRole = (s: ServerSupabase, org: string, userId: string, role: string) => call(s.rpc("set_member_role", { p_org: org, p_user: userId, p_role: role }));

export type OrgSummary = { members: number; students: number; sharing: number; shown: boolean; blocks_completed: number | null; minutes_completed: number | null; assignments_due_7d: number | null; overdue_assignments: number | null; avg_latest_quiz: number | null };
export type RosterEntry = { user_id: string; display_name: string; role: string; share_progress: boolean };
export type OrgView = {
  id: string;
  name: string;
  role: "student" | "teacher" | "admin";
  shareProgress: boolean;
  staff: null | { joinCode: string; roster: RosterEntry[]; summary: OrgSummary };
};

/** The signed-in user's organisations, with the staff view (code, roster, last-7-day aggregates) where they're staff. */
export async function listMyOrganizations(supabase: ServerSupabase, userId: string, now: number): Promise<OrgView[]> {
  const { data, error } = await supabase.from("memberships").select("org_id, role, share_progress, organizations(name)").eq("user_id", userId).order("created_at");
  if (error) throw fromDbError(error);
  const since = new Date(now - 7 * 86400_000).toISOString();
  return Promise.all(
    data.map(async (m) => {
      const role = m.role as OrgView["role"];
      const base = { id: m.org_id, name: (m.organizations as unknown as { name: string }).name, role, shareProgress: m.share_progress };
      if (role === "student") return { ...base, staff: null };
      const [joinCode, roster, summary] = await Promise.all([
        call(supabase.rpc("organization_join_code", { p_org: m.org_id })),
        call(supabase.rpc("org_members", { p_org: m.org_id })),
        call(supabase.rpc("org_class_summary", { p_org: m.org_id, p_since: since })),
      ]);
      return { ...base, staff: { joinCode: joinCode as string, roster: roster as RosterEntry[], summary: (summary as OrgSummary[])[0] } };
    }),
  );
}
