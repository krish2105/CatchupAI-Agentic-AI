"use client";

import { Compass } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/features/auth/turnstile";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import { browserClient } from "@/lib/supabase/client";

/**
 * One-click demo: a temporary anonymous account preloaded with synthetic data. When a Turnstile site key is
 * configured, Supabase verifies the CAPTCHA token server-side before creating the account.
 */
export default function DemoButton({ className = "btn", label = "Try the demo" }: { className?: string; label?: string }) {
  const router = useRouter();
  // With bot protection on, the check appears only after the visitor asks for the demo (one check per page).
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function failCheck() {
    setChecking(false);
    setError("The human check didn't finish. An ad or script blocker can stop it. Try again.");
  }

  async function start(token: string | null) {
    setError(null);
    setChecking(false);
    try {
      setStage("Creating your demo space…");
      const { error: signInError } = await browserClient().auth.signInAnonymously(token ? { options: { captchaToken: token } } : undefined);
      if (signInError) throw new Error(signInError.status === 429 ? "Too many demo sessions from this network. Try again later." : "The demo couldn't start. Try again.");
      setStage("Loading synthetic courses and notes…");
      await api("/api/demo/seed", { method: "POST", body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError || e instanceof Error ? e.message : "The demo couldn't start.");
      setStage(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
      <button type="button" className={className} onClick={() => (TURNSTILE_SITE_KEY ? setChecking(true) : void start(null))} disabled={stage !== null || checking}>
        {stage ? <span className="spinner" aria-hidden="true" /> : <Compass className="ic" aria-hidden="true" />} {stage ?? (checking ? "Verifying you're human…" : label)}
      </button>
      {checking ? <Turnstile onToken={(t) => (t ? void start(t) : failCheck())} /> : null}
      {error ? (
        <Notice tone="danger" title={error}>
          <p><Link className="text-link inline" href="/watch">Watch a recorded real run instead</Link>, no check needed.</p>
        </Notice>
      ) : null}
    </div>
  );
}
