"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { APP_ROUTES, routeForPath } from "@/lib/nav/routes";
import Brand from "./brand";
import ThemeButton from "./theme-button";

export type ShellUser = { displayName: string; email: string };
export type ShellMilestone = { completed: number; total: number } | null;

function initials(name: string) {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function MilestoneBrief({ milestone }: { milestone: ShellMilestone }) {
  const total = milestone?.total ?? 0;
  const completed = milestone?.completed ?? 0;
  const dots = 5;
  const filled = total > 0 ? Math.round((completed / total) * dots) : 0;
  return (
    <div className="side-brief">
      <div className="tag">YOUR NEXT MILESTONE</div>
      {total > 0 ? (
        <>
          <strong>{completed === total ? "Plan complete." : "Keep the momentum."}</strong>
          <p>{completed} of {total} approved tasks done.</p>
        </>
      ) : (
        <>
          <strong>No active plan yet.</strong>
          <p>Approve a recovery route in the lab to start tracking.</p>
        </>
      )}
      <div className="side-dots" aria-hidden="true">
        {Array.from({ length: dots }, (_, i) => <i key={i} className={i < filled ? "filled" : undefined} />)}
      </div>
    </div>
  );
}

export default function AppShell({
  user,
  milestone,
  children,
}: {
  user: ShellUser | null;
  milestone: ShellMilestone;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const route = routeForPath(pathname);
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // The main column is inert while the drawer is open; focus after the state change lands.
    requestAnimationFrame(() => menuRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    sidebarRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !sidebarRef.current) return;
      const focusables = sidebarRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const groups = [
    { key: "workspace", heading: "Mission workspace" },
    { key: "explore", heading: "Improve & explore" },
  ] as const;

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {open ? <button type="button" className="drawer-backdrop" aria-label="Close navigation" onClick={close} /> : null}
      <aside ref={sidebarRef} id="sidebar" className={`sidebar${open ? " open" : ""}`} aria-label="Primary navigation">
        <Brand href="/dashboard" />
        <button type="button" className="icon-btn close-drawer" aria-label="Close navigation" onClick={close}>
          <X className="ic" aria-hidden="true" />
        </button>
        {groups.map((group) => (
          <div key={group.key}>
            <div className="nav-heading" id={`nav-${group.key}`}>{group.heading}</div>
            <nav aria-labelledby={`nav-${group.key}`}>
              {APP_ROUTES.filter((r) => r.group === group.key).map((r) => {
                const active = route?.href === r.href;
                const Icon = r.icon;
                return (
                  <Link
                    key={r.href}
                    href={r.href}
                    className={`nav-item${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="ic" aria-hidden="true" />
                    {r.label}
                    {r.badge ? <small>{r.badge}</small> : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
        <div className="side-bottom">
          <MilestoneBrief milestone={milestone} />
          {user ? (
            <div className="side-foot">
              <div className="avatar" aria-hidden="true">{initials(user.displayName || user.email)}</div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName || "Student"}</strong>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
      <div className="main" inert={open ? true : undefined}>
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              ref={menuRef}
              type="button"
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              aria-controls="sidebar"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu className="ic" aria-hidden="true" />
            </button>
            <div className="crumb">
              <span>YOUR SPACE</span>
              <span className="slash" aria-hidden="true">/</span>
              <b>{(route?.crumb ?? "CatchUp AI").toUpperCase()}</b>
            </div>
          </div>
          <div className="top-actions">
            <ThemeButton />
            {user ? (
              <Link href="/settings" className="top-avatar" aria-label={`Account settings for ${user.displayName || user.email}`}>
                {initials(user.displayName || user.email)}
              </Link>
            ) : null}
          </div>
        </header>
        <main id="main" tabIndex={-1} className="page">
          <div className="content">{children}</div>
        </main>
      </div>
    </div>
  );
}
