import { redirect } from "next/navigation";
import AppShell from "@/components/shell/app-shell";
import { requirePageUser, withSessionRecovery } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";
import { getNotifications } from "@/lib/db/notifications";
import { getMilestone } from "@/lib/db/progress";
import { renderTime } from "@/lib/server/clock";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requirePageUser();
  const now = await renderTime();
  const [profile, milestone, notices] = await withSessionRecovery(Promise.all([getProfile(supabase, user.id), getMilestone(supabase), getNotifications(supabase, now)]));
  if (!profile.onboarded) redirect("/onboarding");
  return (
    <AppShell user={{ displayName: profile.displayName ?? "", email: user.email, isAnonymous: user.isAnonymous }} milestone={milestone} notices={notices}>
      {children}
    </AppShell>
  );
}
