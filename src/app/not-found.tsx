import { ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <div className="eyebrow">404 / Lost in orbit</div>
        <h1>This page doesn&apos;t exist.</h1>
        <p>It may have moved, or you may not have access to it.</p>
        <div className="hero-ctas"><ButtonLink href="/dashboard" variant="primary">Back to mission control</ButtonLink></div>
      </div>
    </main>
  );
}
