import { z } from "zod";
import { uuid } from "./common";

export const documentCreate = z
  .object({
    courseId: uuid,
    filename: z
      .string()
      .trim()
      .min(5)
      .max(200)
      .regex(/\.pdf$/i, "Only .pdf files are accepted")
      .refine((name) => !/[\\/\u0000-\u001f]/.test(name), "Invalid file name"),
    sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
  })
  .strict();

export const searchQuery = z.object({ q: z.string().trim().min(2).max(500) });
