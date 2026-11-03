import { NextResponse } from "next/server";

/** Liveness check for uptime monitors. Reveals nothing about configuration or data. */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
