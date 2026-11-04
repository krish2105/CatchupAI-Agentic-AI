"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn, RotateCcw } from "lucide-react";
import { Notice } from "@/components/ui/primitives";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // Report to the self-hosted error tracker (redacted and grouped on the server). Best effort, once per error.
  useEffect(() => {
    void fetch("/api/errors/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: error.name, message: error.message.slice(0, 1000), digest: error.digest, path: window.location.pathname }),
    }).catch(() => undefined);
  }, [error]);
  // Server Component errors need fresh server data, not just a client re-render.
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return (
    <div style={{ maxWidth: 620 }}>
      <Notice tone="danger" title="This view couldn't load">
        <p style={{ margin: "4px 0 12px" }}>Nothing was changed. You can retry; if your session expired, sign in again. If it keeps failing, share this reference: <code>{error.digest ?? "n/a"}</code></p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn small" onClick={retry}><RotateCcw className="ic" aria-hidden="true" /> Try again</button>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="next" value="/login" />
            <button type="submit" className="btn small ghost"><LogIn className="ic" aria-hidden="true" /> Sign in again</button>
          </form>
        </div>
      </Notice>
    </div>
  );
}
