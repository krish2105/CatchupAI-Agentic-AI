import { NextResponse } from "next/server";
import { ZodError } from "zod";

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

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status >= 500) console.error(`[api] ${error.code}`, error.details ?? "");
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.status < 500 ? error.details : undefined } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "Some values are invalid.", details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
      { status: 400 },
    );
  }
  const correlationId = crypto.randomUUID();
  console.error(`[api] unhandled ${correlationId}`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong.", correlationId } }, { status: 500 });
}

/** Wraps a route handler with uniform error handling. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return jsonError(error);
    }
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
