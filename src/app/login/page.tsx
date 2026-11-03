import type { Metadata } from "next";
import Brand from "@/components/shell/brand";
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
      </div>
    </main>
  );
}
