"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = { render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void }) => string };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Cloudflare Turnstile widget. Renders only when a site key is configured; Supabase Auth verifies the token
 * server-side (Auth > Attack protection), so this protects email sign-in and the one-click demo alike.
 */
export default function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const render = () => window.turnstile && el.current && window.turnstile.render(el.current, { sitekey: TURNSTILE_SITE_KEY, callback: onToken, "expired-callback": () => onToken(null) });
    if (window.turnstile) return void render();
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
    if (existing) return void existing.addEventListener("load", render);
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.turnstile = "true";
    script.onload = render;
    document.head.appendChild(script);
  }, [onToken]);
  return TURNSTILE_SITE_KEY ? <div ref={el} /> : null;
}
