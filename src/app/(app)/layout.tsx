import { redirect } from "next/navigation";
import AppShell from "@/components/shell/app-shell";
import { requirePageUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";
import { getMilestone } from "@/lib/db/progress";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requirePageUser();
  const [profile, milestone] = await Promise.all([getProfile(supabase, user.id), getMilestone(supabase)]);
  if (!profile.onboarded) redirect("/onboarding");
  return (
    <AppShell user={{ displayName: profile.displayName ?? "", email: user.email, isAnonymous: user.isAnonymous }} milestone={milestone}>
      {children}
    </AppShell>
  );
}
