"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/features/auth/turnstile";
import { Notice } from "@/components/ui/primitives";
import { browserClient } from "@/lib/supabase/client";

export default function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(linkError ? "That sign-in link is invalid or has expired. Request a new code." : null);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await browserClient().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`, ...(captcha ? { captchaToken: captcha } : {}) },
    });
    setBusy(false);
    if (error) setError(error.status === 429 ? "Too many requests. Please wait a minute and try again." : "We couldn't send a code to that address.");
    else setStage("code");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await browserClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setError("That code is incorrect or has expired.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <>
      {error ? <div style={{ marginTop: 18 }}><Notice tone="danger" title={error} /></div> : null}
      {stage === "email" ? (
        <form onSubmit={sendCode} style={{ display: "grid", gap: 14, marginTop: 22 }}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" className="input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            <span className="field-hint">We&apos;ll email you a 6-digit sign-in code. New here? This creates your account.</span>
          </div>
          <Turnstile onToken={setCaptcha} />
          <button className="btn primary" type="submit" disabled={busy || Boolean(TURNSTILE_SITE_KEY && !captcha)}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null} Send sign-in code <ArrowRight className="ic" aria-hidden="true" />
          </button>
        </form>
      ) : (
        <form onSubmit={verify} style={{ display: "grid", gap: 14, marginTop: 22 }}>
          <Notice tone="info" title={`Code sent to ${email}`}>Check your inbox. The code expires in 15 minutes.</Notice>
          <div className="field">
            <label htmlFor="code">6-digit code</label>
            <input
              id="code"
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              style={{ letterSpacing: 6, fontSize: 18 }}
            />
          </div>
          <button className="btn primary" type="submit" disabled={busy || code.length !== 6}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <MailCheck className="ic" aria-hidden="true" />} Verify and sign in
          </button>
          <button className="btn ghost small" type="button" onClick={() => { setStage("email"); setCode(""); }}>Use a different email</button>
        </form>
      )}
    </>
  );
}
