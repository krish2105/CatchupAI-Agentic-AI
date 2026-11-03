import { NextResponse } from "next/server";
import { verifyUnsubscribe } from "@/lib/nudges/sign";
import { unsubscribe } from "@/lib/nudges/service";
import { adminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/common";

/** Signed one-click unsubscribe from a nudge email; works without signing in. */
async function handle(request: Request, html: boolean) {
  const params = new URL(request.url).searchParams;
  const user = uuid.safeParse(params.get("u"));
  if (!user.success || !verifyUnsubscribe(user.data, params.get("s") ?? "")) {
    return html ? page("This unsubscribe link isn't valid. You can turn emails off in Preferences.", 400) : NextResponse.json({ error: { code: "invalid_link" } }, { status: 400 });
  }
  await unsubscribe(adminClient(), user.data);
  return html ? page("Done. You won't get any more study emails. You can turn them back on in Preferences.", 200) : NextResponse.json({ unsubscribed: true });
}

function page(message: string, status: number) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CatchUp AI emails</title></head><body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;line-height:1.6"><h1 style="font-size:20px">CatchUp AI</h1><p>${message}</p><p><a href="/settings">Open Preferences</a></p></body></html>`;
  return new NextResponse(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export const GET = (request: Request) => handle(request, true);
// Mail clients send RFC 8058 one-click unsubscribes as a POST without an Origin from this site.
export const POST = (request: Request) => handle(request, false);
