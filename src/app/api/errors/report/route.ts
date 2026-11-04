import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { ApiError, readJson, route } from "@/lib/http/errors";
import { recordAppError } from "@/lib/observability/app-errors";
import { ReportThrottle } from "@/lib/observability/error-text";

const body = z.object({
  name: z.string().max(100).optional(),
  message: z.string().max(1000),
  digest: z.string().max(100).optional(),
  path: z.string().max(300).startsWith("/"),
}).strict();

// At most 10 reports per student per 10 minutes on each server instance; repeats only bump a group's count.
const throttle = new ReportThrottle(10, 10 * 60_000);

/**
 * Error boundaries in the browser report what broke. The student is identified only to throttle; no user id
 * is stored. Text is redacted and grouped by recordAppError like server errors.
 */
export const POST = route(async (request: Request) => {
  const { user } = await requireApiUser();
  const input = body.parse(await readJson(request, 4 * 1024));
  if (!throttle.allow(user.id)) throw new ApiError(429, "rate_limited", "Too many error reports.");
  const error = { name: input.name || "ClientError", message: input.digest ? `${input.message} (digest ${input.digest})` : input.message };
  await recordAppError({ source: "boundary", path: input.path, error });
  return NextResponse.json({ ok: true }, { status: 202 });
});
