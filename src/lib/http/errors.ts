import { runInRequestScope } from "./request-scope";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logEvent } from "@/lib/observability/log";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type PgLikeError = { code?: string; message?: string };

/** Maps Postgres/PostgREST error codes to safe client errors. Never forwards raw DB messages. */
export function fromDbError(error: PgLikeError, notFoundMessage = "Not found."): ApiError {
  switch (error.code) {
    case "PGRST116":
      return new ApiError(404, "not_found", notFoundMessage);
    // The database rejected the access token (expired, malformed, or signed by a rotated key).
    case "PGRST301":
    case "PGRST302":
    case "PGRST303":
      return new ApiError(401, "session_expired", "Your session has expired. Sign in again.");
    case "23505":
      return new ApiError(409, "conflict", "That already exists.");
    case "23P01":
      return new ApiError(409, "schedule_conflict", "That would overlap another scheduled task.");
    case "23503":
      return new ApiError(404, "not_found", notFoundMessage);
    case "23514":
    case "22023":
    case "22P02":
    case "22007":
    case "22008":
      return new ApiError(400, "invalid_input", "Some values are invalid.");
    case "42501":
      return new ApiError(403, "forbidden", "You don't have access to that.");
    default:
      return new ApiError(500, "internal", "Something went wrong.");
  }
}

export function jsonError(error: unknown, ctx: { requestId?: string; path?: string } = {}) {
  if (error instanceof ApiError) {
    if (error.status >= 500) logEvent("error", "api.error", { ...ctx, status: error.status, code: error.code, detail: typeof error.details === "string" ? error.details : undefined });
    // Abuse and access signals: rate limits, forbidden origins/ownership, expired sessions.
    else if ([401, 403, 429].includes(error.status)) logEvent("warn", "api.denied", { ...ctx, status: error.status, code: error.code });
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.status < 500 ? error.details : undefined } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "Some values are invalid.", details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
      { status: 400 },
    );
  }
  const correlationId = ctx.requestId ?? crypto.randomUUID();
  logEvent("error", "api.unhandled", { ...ctx, correlationId, error: error instanceof Error ? `${error.name}: ${error.message}` : "non-error thrown" });
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong.", correlationId } }, { status: 500 });
}

/**
 * Wraps a route handler with uniform error handling, a request id on every response (from the proxy) and a
 * structured log line for slow, failed or denied requests.
 */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : null;
    const requestId = request?.headers.get("x-request-id") ?? undefined;
    const path = request ? new URL(request.url).pathname : undefined;
    const started = Date.now();
    let response: Response;
    try {
      // The request scope lets an authenticated write clear that student's cached tool reads.
      response = await runInRequestScope(request?.method ?? "GET", () => handler(...args));
    } catch (error) {
      response = jsonError(error, { requestId, path });
    }
    const ms = Date.now() - started;
    if (ms > 3000 || response.status >= 500) logEvent(response.status >= 500 ? "error" : "warn", "api.request", { requestId, path, method: request?.method, status: response.status, ms });
    if (requestId && !response.headers.has("x-request-id")) {
      try {
        response.headers.set("x-request-id", requestId);
      } catch {
        /* immutable headers (redirects) */
      }
    }
    return response;
  };
}

export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new ApiError(413, "payload_too_large", "Request body is too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(413, "payload_too_large", "Request body is too large.");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}
