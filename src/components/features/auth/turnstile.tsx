"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = { render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void; "timeout-callback"?: () => void }) => string };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Cloudflare Turnstile widget. Renders only when a site key is configured; Supabase Auth verifies the token
 * server-side (Auth > Attack protection), so this protects email sign-in and the one-click demo alike.
 * Expiry, a failed or timed-out challenge, or a blocked script all report `null`, so callers never wait forever.
 */
export default function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-rendering the widget when the parent re-renders.
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  });
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const fail = () => callback.current(null);
    const render = () => window.turnstile && el.current && !el.current.childElementCount && window.turnstile.render(el.current, { sitekey: TURNSTILE_SITE_KEY, callback: (t) => callback.current(t), "expired-callback": fail, "error-callback": fail, "timeout-callback": fail });
    if (window.turnstile) return void render();
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
    if (existing) {
      existing.addEventListener("load", render);
      existing.addEventListener("error", fail);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.turnstile = "true";
    script.onload = render;
    // An ad or script blocker stops the check from loading at all; report it instead of spinning. The dead tag is
    // removed so "Try again" loads the script afresh instead of waiting on a tag that will never fire.
    script.onerror = () => {
      script.remove();
      fail();
    };
    document.head.appendChild(script);
  }, []);
  return TURNSTILE_SITE_KEY ? <div ref={el} /> : null;
}
