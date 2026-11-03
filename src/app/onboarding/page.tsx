import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Brand from "@/components/shell/brand";
import ProfileForm from "@/components/features/profile/profile-form";
import { requirePageUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";

export const metadata: Metadata = { title: "Set up your week" };

export default async function OnboardingPage() {
  const { supabase, user } = await requirePageUser("/onboarding");
  const profile = await getProfile(supabase, user.id);
  if (profile.onboarded) redirect("/dashboard");
  return (
    <main className="auth-wrap">
      <div className="card auth-card" style={{ width: "min(100%, 720px)" }}>
        <Brand />
        <div className="eyebrow" style={{ marginTop: 26 }}>Step 1 of 1 · Your real week</div>
        <h1>How much time do you <span className="serif" style={{ color: "var(--accent)" }}>actually have?</span></h1>
        <p style={{ marginBottom: 22 }}>CatchUp AI never plans more study than you say you have. You can change this any time in Preferences.</p>
        <ProfileForm profile={profile} onboarding />
      </div>
    </main>
  );
}
