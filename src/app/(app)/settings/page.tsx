import type { Metadata } from "next";
import AppearanceCard from "@/components/features/settings/appearance-card";
import PageHeading from "@/components/ui/page-heading";
import { Chip } from "@/components/ui/primitives";
import { aiRuntimeStatus } from "@/lib/server/env";

export const metadata: Metadata = { title: "Preferences" };

export default async function SettingsPage() {
  const ai = await aiRuntimeStatus();
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
            {ai.configured ? <Chip tone="good">{ai.model}</Chip> : <Chip tone="warn">Not configured</Chip>}
          </div>
          <div className="setting-line">
            <div><strong>Your data</strong><p>Courses, documents and plans are private to your account and protected by row-level security.</p></div>
          </div>
        </div>
      </div>
    </>
  );
}
