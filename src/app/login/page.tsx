import type { Metadata } from "next";
import Brand from "@/components/shell/brand";
import DemoButton from "@/components/features/demo/demo-button";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";
  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <Brand />
        <div className="eyebrow" style={{ marginTop: 26 }}>Welcome back</div>
        <h1>Sign in to <span className="serif" style={{ color: "var(--accent)" }}>CatchUp AI</span></h1>
        <p>Passwordless sign-in. Your courses, documents and plans are private to your account.</p>
        <LoginForm next={next} linkError={params.error === "link"} />
        <div className="line" style={{ margin: "22px 0 16px" }} />
        <p style={{ marginBottom: 10 }}>Just looking? Explore a temporary demo account with synthetic data. It&apos;s deleted after 24 hours.</p>
        <DemoButton className="btn ghost small" />
      </div>
    </main>
  );
}
