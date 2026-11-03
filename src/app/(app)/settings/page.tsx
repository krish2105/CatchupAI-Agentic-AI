import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import AppearanceCard from "@/components/features/settings/appearance-card";
import ProfileForm from "@/components/features/profile/profile-form";
import PageHeading from "@/components/ui/page-heading";
import { Chip } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";
import { aiRuntimeStatus } from "@/lib/server/env";

export const metadata: Metadata = { title: "Preferences" };

export default async function SettingsPage() {
  const { supabase, user } = await requirePageUser("/settings");
  const [ai, profile] = await Promise.all([aiRuntimeStatus(), getProfile(supabase, user.id)]);
  return (
    <>
      <PageHeading
        eyebrow="Personalize the experience"
        title="Make this space"
        accent="yours."
        accentColor="violet"
        description="Every view adapts to your theme and motion preferences. Immersive when you want it, calm when you don't."
      />
      <div className="settings-grid">
        <AppearanceCard />
        <div className="card setting-card">
          <div className="split-head"><h3>About this workspace</h3></div>
          <div className="setting-line">
            <div><strong>AI runtime</strong><p>The copilot and quiz generator need a configured OpenAI model on the server.</p></div>
            {ai.kind === "scripted" ? <Chip tone="warn">Scripted test model</Chip> : ai.configured ? <Chip tone="good">{ai.model}</Chip> : <Chip tone="warn">Not configured</Chip>}
          </div>
          <div className="setting-line">
            <div><strong>Your data</strong><p>Courses, documents and plans are private to your account and protected by row-level security.</p></div>
          </div>
          <div className="setting-line">
            <div><strong>Signed in</strong><p>{user.email}</p></div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn small"><LogOut className="ic" aria-hidden="true" /> Sign out</button>
            </form>
          </div>
        </div>
      </div>
      <div className="card setting-card section-space">
        <div className="split-head"><h3>Your week</h3></div>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 18 }}>The planner never schedules more than these minutes per day, in your time zone.</p>
        <ProfileForm profile={profile} />
      </div>
    </>
  );
}
