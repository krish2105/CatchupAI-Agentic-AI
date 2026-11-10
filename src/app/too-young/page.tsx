import type { Metadata } from "next";
import Link from "next/link";
import Brand from "@/components/shell/brand";

export const metadata: Metadata = { title: "CatchUp AI is for students aged 13 and over" };

/** Shown after a student says they are under 13 at onboarding. Their sign-in has already been deleted. */
export default function TooYoungPage() {
  return (
    <main className="auth-wrap">
      <div className="card auth-card" style={{ width: "min(100%, 560px)" }}>
        <Brand />
        <h1 style={{ marginTop: 26 }}>Thanks for being honest.</h1>
        <p>CatchUp AI is for students aged 13 and over, following UAE Ministry of Education guidance on generative AI in schools.</p>
        <p>We haven&apos;t kept anything: your sign-in has been deleted, and no age or other details were stored.</p>
        <p>A parent, guardian or teacher can help you find study tools made for your age.</p>
        <p style={{ marginTop: 18 }}><Link className="text-link inline" href="/">Back to the home page</Link></p>
      </div>
    </main>
  );
}
