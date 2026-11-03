"use client";

import Link from "next/link";
import { Bell, CalendarClock, ClipboardCheck, Clock3, RefreshCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Notice } from "@/lib/db/notifications";

const ICONS = { approval: ClipboardCheck, deadline: CalendarClock, today: Clock3, missed: RefreshCcw } as const;

/** Header bell: real attention items (pending drafts, deadlines within 48 h, upcoming blocks). */
export default function NotificationBell({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="icon-btn bell-btn"
        aria-label={notices.length ? `Notifications, ${notices.length} need attention` : "Notifications, nothing new"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="ic" aria-hidden="true" />
        {notices.length ? <span className="bell-count" aria-hidden="true">{notices.length}</span> : null}
      </button>
      {open ? (
        <div id={panelId} className="bell-panel" role="region" aria-label="Notifications">
          <strong className="bell-title">Needs your attention</strong>
          {notices.length ? (
            <ul>
              {notices.map((n) => {
                const Icon = ICONS[n.kind];
                return (
                  <li key={n.id}>
                    <Link href={n.href} onClick={() => setOpen(false)}>
                      <span className="bell-icon" aria-hidden="true"><Icon className="ic" /></span>
                      <span><b>{n.title}</b><span>{n.detail}</span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>You&apos;re all caught up. Drafts awaiting approval and deadlines in the next 48 hours appear here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
