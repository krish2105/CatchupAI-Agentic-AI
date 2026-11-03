import "server-only";
import { z } from "zod";
import { fromDbError } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

export const FEEDBACK_KINDS = ["plan", "answer", "pack", "teach", "general"] as const;

export const feedbackSchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS),
    ref: z.string().trim().min(1).max(100).optional(),
    rating: z.union([z.literal(1), z.literal(-1)]).optional(),
    comment: z.string().trim().min(1).max(1000).optional(),
    page: z.string().trim().max(200).regex(/^\/[\w\-/?=&.%]*$/).optional(),
  })
  .strict()
  .refine((f) => f.rating !== undefined || f.comment !== undefined, { message: "Add a rating or a comment." });
export type FeedbackInput = z.infer<typeof feedbackSchema>;

/** Stores one piece of feedback for the signed-in student (owner from the column default, under RLS). */
export async function saveFeedback(supabase: ServerSupabase, input: FeedbackInput) {
  const { error } = await supabase.from("feedback").insert({ kind: input.kind, ref: input.ref ?? null, rating: input.rating ?? null, comment: input.comment ?? null, page: input.page ?? null });
  if (error) throw fromDbError(error);
}
