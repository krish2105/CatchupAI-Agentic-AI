import { createClient } from "@supabase/supabase-js";

/** Test-only privileged client for arranging other tenants' data. Local stack only. */
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("E2E admin helper is local-only");
  return createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

export async function createOtherTenant() {
  const db = adminDb();
  const email = `other-${Date.now().toString(36)}@test.catchup.local`;
  const { data: user, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const ownerId = user.user.id;
  const { data: course } = await db.from("courses").insert({ owner_id: ownerId, title: "Private course of B" }).select("id").single();
  const { data: assignment } = await db
    .from("assignments")
    .insert({ owner_id: ownerId, course_id: course!.id, title: "B's secret assignment", due_at: new Date(Date.now() + 86400_000).toISOString(), estimated_minutes: 60 })
    .select("id")
    .single();
  return { ownerId, courseId: course!.id as string, assignmentId: assignment!.id as string, cleanup: () => db.auth.admin.deleteUser(ownerId) };
}

/**
 * A brand-new, onboarded student signed in through the real /auth/confirm magic-link route
 * (token from the local admin API). Isolated data per test.
 */
export async function freshStudent(
  browser: import("@playwright/test").Browser,
  profile: { timezone?: string; weekly_minutes?: number[]; study_start_time?: string } = {},
) {
  const db = adminDb();
  const email = `fresh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@test.catchup.local`;
  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await db
    .from("profiles")
    .update({ display_name: "Fresh Student", timezone: "UTC", weekly_minutes: [120, 120, 120, 120, 120, 120, 120], study_start_time: "00:30", onboarded_at: new Date().toISOString(), ...profile })
    .eq("id", userId);
  const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties) throw linkError ?? new Error("generateLink returned no token");
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto(`/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/dashboard`);
  await page.waitForURL(/\/dashboard$/);
  return { page, context, userId, db, cleanup: async () => { await context.close(); await db.auth.admin.deleteUser(userId); } };
}
