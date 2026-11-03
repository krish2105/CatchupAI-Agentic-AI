import "server-only";
import { TZDate } from "@date-fns/tz";
import { ApiError, fromDbError } from "@/lib/http/errors";
import { processDocument } from "@/lib/rag/ingest";
import type { Embedder } from "@/lib/rag/embed";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { DEMO_PDF_BASE64, DEMO_PDF_NAME } from "./demo-pdf";

/** Fictional scenario (data/demo_scenario.json), with deadlines placed relative to "today" in the visitor's zone. */
export function demoScenario(now: number, timezone: string) {
  const today = new TZDate(now, timezone);
  const at = (days: number, hour: number) => new Date(new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + days, hour, 0, 0, timezone).getTime()).toISOString();
  return {
    profile: { display_name: "Alex (demo)", timezone, weekly_minutes: [90, 90, 90, 90, 90, 60, 60], study_start_time: "17:00" },
    courses: [
      {
        title: "Applied Statistics",
        description: "Regression, sampling and foundational statistical modelling.",
        withNotes: true,
        assignments: [{ title: "Regression analysis worksheet", due_at: at(4, 16), estimated_minutes: 240 }],
      },
      {
        title: "Introduction to Programming",
        description: "Functions, loops, debugging and basic algorithms.",
        withNotes: false,
        assignments: [{ title: "Python functions exercise", due_at: at(3, 16), estimated_minutes: 150 }],
      },
    ],
  };
}

/**
 * Seeds a brand-new anonymous demo account. Writes go through the visitor's own RLS-scoped client exactly like a
 * real student; the admin client is used only inside the standard ingestion pipeline. Refuses non-demo accounts
 * and accounts that already have data (idempotent).
 */
export async function seedDemoAccount(deps: { supabase: ServerSupabase; admin: AdminSupabase; userId: string; isAnonymous: boolean; timezone: string; now: number; embedder: Embedder | null }) {
  const { supabase, admin, userId } = deps;
  if (!deps.isAnonymous) throw new ApiError(403, "not_demo", "Demo data can only be loaded into a demo account.");
  const { count } = await supabase.from("courses").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { seeded: false };

  const scenario = demoScenario(deps.now, deps.timezone);
  const prof = await supabase.from("profiles").update({ ...scenario.profile, onboarded_at: new Date(deps.now).toISOString() }).eq("id", userId);
  if (prof.error) throw fromDbError(prof.error);

  for (const course of scenario.courses) {
    const { data: created, error } = await supabase.from("courses").insert({ title: course.title, description: course.description }).select("id").single();
    if (error) throw fromDbError(error);
    for (const a of course.assignments) {
      const res = await supabase.from("assignments").insert({ course_id: created.id, ...a });
      if (res.error) throw fromDbError(res.error);
    }
    if (course.withNotes) {
      const bytes = Buffer.from(DEMO_PDF_BASE64, "base64");
      const doc = await supabase.from("documents").insert({ course_id: created.id, filename: DEMO_PDF_NAME, size_bytes: bytes.byteLength }).select("id, storage_path").single();
      if (doc.error) throw fromDbError(doc.error);
      const up = await supabase.storage.from("course-documents").upload(doc.data.storage_path!, bytes, { contentType: "application/pdf", upsert: false });
      if (up.error) throw new ApiError(500, "demo_upload_failed", "Couldn't prepare the demo notes.", up.error.message);
      await processDocument({ supabase, admin, userId, documentId: doc.data.id, embedder: deps.embedder });
    }
  }
  return { seeded: true };
}
