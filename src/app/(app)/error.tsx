"use client";

import { RotateCcw } from "lucide-react";
import { Notice } from "@/components/ui/primitives";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ maxWidth: 620 }}>
      <Notice tone="danger" title="This view couldn't load">
        <p style={{ margin: "4px 0 12px" }}>Nothing was changed. You can retry; if it keeps failing, share this reference: <code>{error.digest ?? "n/a"}</code></p>
        <button type="button" className="btn small" onClick={reset}><RotateCcw className="ic" aria-hidden="true" /> Try again</button>
      </Notice>
    </div>
  );
}
