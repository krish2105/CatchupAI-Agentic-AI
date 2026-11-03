import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/universe", "/assistant", "/recovery", "/courses", "/planner", "/quizzes", "/insights", "/settings", "/focus", "/onboarding"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Per-request CSP: scripts run only with this request's nonce ('strict-dynamic' lets them load their own
 * chunks). Inline style attributes are used throughout the UI, so styles allow 'unsafe-inline' (no nonce,
 * which would disable it). Connections are limited to this origin, Supabase and Turnstile.
 */
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs} https://challenges.cloudflare.com`.trim(),
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Refreshes the Supabase session cookie on every request, guards app pages and sets security headers. */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Defence in depth against CSRF (cookies are already SameSite=Lax): a state-changing request that carries
  // an Origin header must come from this site.
  if (!SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin && new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json({ error: { code: "forbidden_origin", message: "Cross-site requests aren't allowed." } }, { status: 403 });
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  const withCsp = (response: NextResponse) => {
    if (!path.startsWith("/api/")) response.headers.set("content-security-policy", csp);
    return response;
  };

  let response = next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return withCsp(response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        // Forward the refreshed cookies to the page render too.
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        response = next();
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims() verifies the JWT; do not run other logic between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  if (signedIn && path === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/dashboard";
    home.search = "";
    return NextResponse.redirect(home);
  }
  return withCsp(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|orbital-atelier-preview.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)"],
};
