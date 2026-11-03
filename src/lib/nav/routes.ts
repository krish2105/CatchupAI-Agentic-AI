import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FlaskConical,
  House,
  Leaf,
  LifeBuoy,
  type LucideIcon,
  Orbit,
  Settings,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export type AppRoute = {
  href: string;
  label: string;
  crumb: string;
  icon: LucideIcon;
  badge?: string;
  group: "workspace" | "explore";
};

/** The nine Orbital Atelier screens (docs/11_UI_SCREEN_MAPPING.md). */
export const APP_ROUTES: AppRoute[] = [
  { href: "/dashboard", label: "Mission control", crumb: "Mission control", icon: House, group: "workspace" },
  { href: "/universe", label: "Learning universe", crumb: "Learning universe", icon: Orbit, badge: "3D", group: "workspace" },
  { href: "/assistant", label: "AI copilot", crumb: "AI copilot", icon: Sparkles, group: "workspace" },
  { href: "/catch-up", label: "Catch-up pack", crumb: "Catch-up pack", icon: LifeBuoy, group: "workspace" },
  { href: "/recovery", label: "Recovery lab", crumb: "Recovery lab", icon: FlaskConical, group: "workspace" },
  { href: "/courses", label: "Knowledge vault", crumb: "Knowledge vault", icon: BookOpen, group: "workspace" },
  { href: "/planner", label: "Study schedule", crumb: "Study schedule", icon: CalendarDays, group: "workspace" },
  { href: "/quizzes", label: "Practice arena", crumb: "Practice arena", icon: ClipboardCheck, group: "explore" },
  { href: "/insights", label: "Your momentum", crumb: "Your momentum", icon: TrendingUp, group: "explore" },
  { href: "/focus", label: "Focus sanctuary", crumb: "Focus sanctuary", icon: Leaf, group: "explore" },
  { href: "/settings", label: "Preferences", crumb: "Preferences", icon: Settings, group: "explore" },
];

export function routeForPath(pathname: string): AppRoute | undefined {
  return APP_ROUTES.find((r) => pathname === r.href || pathname.startsWith(`${r.href}/`));
}
