import { z } from "zod";
import { isoInstant, timeZone, uuid } from "./common";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const courseCreate = z.object({ title: text(1, 120), description: text(0, 1000).default("") }).strict();
export const courseUpdate = courseCreate.partial().strict().refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const assignmentStatus = z.enum(["todo", "in_progress", "completed"]);
export const assignmentCreate = z
  .object({
    courseId: uuid,
    title: text(1, 200),
    notes: text(0, 2000).default(""),
    dueAt: isoInstant,
    estimatedMinutes: z.number().int().min(5).max(10080),
    required: z.boolean().default(true),
    status: assignmentStatus.default("todo"),
  })
  .strict();
export const assignmentUpdate = assignmentCreate
  .omit({ courseId: true })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const profileUpdate = z
  .object({
    displayName: text(1, 80).nullable(),
    timezone: timeZone,
    weeklyMinutes: z.array(z.number().int().min(0).max(720)).length(7),
    studyStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    completeOnboarding: z.boolean(),
    // Onboarding asks the student to confirm they are 13 or older; it isn't stored, only required to finish.
    ageConfirmed: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => !v.completeOnboarding || v.ageConfirmed === true, { message: "Confirm that you are 13 or older to continue.", path: ["ageConfirmed"] });

export type CourseCreate = z.infer<typeof courseCreate>;
export type AssignmentCreate = z.infer<typeof assignmentCreate>;
export type ProfileUpdate = z.infer<typeof profileUpdate>;
