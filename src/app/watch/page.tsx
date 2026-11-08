import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Brand from "@/components/shell/brand";
import ThemeButton from "@/components/shell/theme-button";
import { ButtonLink } from "@/components/ui/primitives";
import ReplayPlayer from "@/components/features/replay/replay-player";
import { REPLAYS } from "@/lib/quality/replay";

export const metadata: Metadata = { title: "Watch a real run", description: "Step-by-step replays of real CatchUp AI runs on a live model, read from the committed traces." };

/** Public replay of recorded live runs: no sign-in, no bot check and no AI quota used. */
export default function WatchPage() {
  return (
    <div className="lp">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="lp-top">
        <Brand />
        <div className="top-actions">
          <ThemeButton />
          <ButtonLink href="/" small><ArrowLeft className="ic" aria-hidden="true" /> Home</ButtonLink>
        </div>
      </header>
      <main id="main" className="quality">
        <div className="eyebrow">Recorded on a real model</div>
        <h1>Watch a real run.</h1>
        <p className="quality-lead">
          These are real runs on Google Gemini, recorded by the evaluation suite and played back here step by step. Nothing on this page calls a model,
          so it works without signing in. To try it yourself, use the live demo.
        </p>
        <ReplayPlayer replays={REPLAYS} />
        <p className="muted">
          Each run is the latest live result for that case. Pass counts across all live runs are on the <Link className="text-link inline" href="/quality">quality page</Link>.
        </p>
      </main>
      <footer className="lp-foot">
        <Link href="/quality">Quality and trust</Link>
        <Link href="/">Back to the home page</Link>
      </footer>
    </div>
  );
}
