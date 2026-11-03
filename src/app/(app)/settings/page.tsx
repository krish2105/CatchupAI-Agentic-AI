import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import AppearanceCard from "@/components/features/settings/appearance-card";
import ProfileForm from "@/components/features/profile/profile-form";
import PrivacyCard from "@/components/features/settings/privacy-card";
import UsageCard from "@/components/features/settings/usage-card";
import { getUsage } from "@/lib/db/usage";
import { renderTime } from "@/lib/server/clock";
import PageHeading from "@/components/ui/page-heading";
import { Chip } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";
import { aiRuntimeStatus } from "@/lib/server/env";

export const metadata: Metadata = { title: "Preferences" };

export default async function SettingsPage() {
  const { supabase, user } = await requirePageUser("/settings");
  const now = await renderTime();
  const [ai, profile, usage] = await Promise.all([aiRuntimeStatus(), getProfile(supabase, user.id), getUsage(supabase, user.isAnonymous, now)]);
  return (
    <>
      <PageHeading
        eyebrow="Personalize the experience"
        title="Make this space yours."
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
      <div className="section-space"><UsageCard rows={usage} isAnonymous={user.isAnonymous} /></div>
      <div className="settings-grid section-space">
        <PrivacyCard />
        <div className="card setting-card">
          <div className="split-head"><h3>Accessibility</h3></div>
          <div className="setting-line"><div><strong>Keyboard</strong><p>Every action works from the keyboard. Press Ctrl or ⌘ + K for the command palette.</p></div></div>
          <div className="setting-line"><div><strong>Motion and 3D</strong><p>Reduce motion stops orbiting and transitions; turning 3D off replaces scenes with lists that carry the same information.</p></div></div>
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
