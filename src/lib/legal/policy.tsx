import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import Brand from "@/components/shell/brand";
import ThemeButton from "@/components/shell/theme-button";
import { ButtonLink } from "@/components/ui/primitives";

/** Last change to /privacy or /terms. Update it with every wording change. */
export const POLICY_UPDATED = "5 November 2026";

export type PolicySection = { id: string; title: string; body: ReactNode };

/** Shared layout for the plain-language privacy notice and terms (public, no sign-in). */
export function PolicyPage({ eyebrow, title, intro, sections, other }: { eyebrow: string; title: string; intro: ReactNode; sections: PolicySection[]; other: { href: string; label: string } }) {
  return (
    <div className="lp">
      <header className="lp-top">
        <Brand />
        <div className="top-actions">
          <ThemeButton />
          <ButtonLink href="/" small><ArrowLeft className="ic" aria-hidden="true" /> Home</ButtonLink>
        </div>
      </header>
      <main id="main" className="quality policy-page">
        <div className="eyebrow">{eyebrow} · last updated {POLICY_UPDATED}</div>
        <h1>{title}</h1>
        <div className="policy-intro">{intro}</div>
        <nav className="card card-inner" aria-label="On this page">
          <ol className="policy-toc">
            {sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}
          </ol>
        </nav>
        {sections.map((s) => (
          <section key={s.id} className="card card-inner policy-section" aria-labelledby={s.id}>
            <h2 id={s.id} className="trace-h2">{s.title}</h2>
            {s.body}
          </section>
        ))}
        <p className="muted">
          See also: <Link href={other.href}>{other.label}</Link> · <Link href="/status">System status</Link> · <Link href="/quality">Quality and trust</Link>
        </p>
      </main>
    </div>
  );
}
