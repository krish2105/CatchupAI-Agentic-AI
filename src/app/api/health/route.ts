import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    product: "CatchUp AI starter",
    service: "Next.js API",
    backendConnected: false,
  });
}
