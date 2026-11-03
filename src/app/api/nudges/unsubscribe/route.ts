import { NextResponse } from "next/server";
import { verifyUnsubscribe } from "@/lib/nudges/sign";
import { unsubscribe } from "@/lib/nudges/service";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

/**
 * Signed one-click unsubscribe from a nudge email; works without signing in. GET only shows a confirmation
 * button (mail scanners prefetch links, so GET must not change anything); POST unsubscribes. Mail clients send
 * RFC 8058 one-click POSTs ("List-Unsubscribe=One-Click") and get a short JSON answer.
 */
function valid(request: Request) {
  const params = new URL(request.url).searchParams;
  const user = uuid.safeParse(params.get("u"));
  return user.success && verifyUnsubscribe(user.data, params.get("s") ?? "") ? user.data : null;
}

export async function GET(request: Request) {
  if (!valid(request)) return page("This unsubscribe link isn't valid. You can turn emails off in Preferences.", 400);
  const action = escapeHtml(new URL(request.url).pathname + new URL(request.url).search);
  return page(`Stop all CatchUp AI study emails?</p><form method="post" action="${action}"><button type="submit" style="font:inherit;padding:8px 16px;border-radius:8px;border:1px solid #2f6b4f;background:#2f6b4f;color:#fff;cursor:pointer">Unsubscribe</button></form><p>`, 200);
}

export async function POST(request: Request) {
  const userId = valid(request);
  const oneClick = (await request.text()).includes("List-Unsubscribe=One-Click");
  if (!userId) return oneClick ? NextResponse.json({ error: { code: "invalid_link" } }, { status: 400 }) : page("This unsubscribe link isn't valid. You can turn emails off in Preferences.", 400);
  await unsubscribe(adminClient(), userId);
  return oneClick ? NextResponse.json({ unsubscribed: true }) : page("Done. You won't get any more study emails. You can turn them back on in Preferences.", 200);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function page(message: string, status: number) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CatchUp AI emails</title></head><body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;line-height:1.6"><h1 style="font-size:20px">CatchUp AI</h1><p>${message}</p><p><a href="/settings">Open Preferences</a></p></body></html>`;
  return new NextResponse(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}
