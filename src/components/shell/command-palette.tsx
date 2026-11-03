"use client";

import { BookOpen, CornerDownLeft, FlaskConical, LifeBuoy, type LucideIcon, Moon, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_ROUTES } from "@/lib/nav/routes";
import { setPreferences, usePreferences } from "@/lib/preferences/store";

type Command = { id: string; label: string; group: "Actions" | "Go to" | "Courses"; icon: LucideIcon; keywords?: string; run: () => void };

/** ⌘K / Ctrl+K palette: navigate, open courses, and launch real actions. */
export default function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme } = usePreferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("catchup:command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("catchup:command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      input.current?.focus();
      fetch("/api/courses", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : { courses: [] }))
        .then((j: { courses: { id: string; title: string }[] }) => setCourses(j.courses.map((c) => ({ id: c.id, title: c.title }))))
        .catch(() => setCourses([]));
    }
    if (!open && d.open) d.close();
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    return [
      { id: "rescue", label: "Start missed class rescue", group: "Actions", icon: LifeBuoy, keywords: "catch up missed lecture copilot", run: go("/assistant?rescue=1") },
      { id: "routes", label: "Compare recovery routes", group: "Actions", icon: FlaskConical, keywords: "plan feasibility schedule", run: go("/recovery") },
      { id: "theme", label: `Switch to ${nextTheme} theme`, group: "Actions", icon: nextTheme === "dark" ? Moon : Sun, keywords: "appearance mode", run: () => setPreferences({ theme: nextTheme }) },
      ...APP_ROUTES.map((r) => ({ id: `go:${r.href}`, label: r.label, group: "Go to" as const, icon: r.icon, keywords: r.href, run: go(r.href) })),
      ...courses.map((c) => ({ id: `course:${c.id}`, label: c.title, group: "Courses" as const, icon: BookOpen, keywords: "course vault", run: go(`/courses/${c.id}`) })),
    ];
  }, [courses, resolvedTheme, router]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q)) : commands;
  }, [commands, query]);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    setQuery("");
    command.run();
  };

  let lastGroup = "";
  return (
    <dialog
      ref={dialog}
      className="modal command-palette"
      aria-label="Command palette"
      // The close event is dispatched asynchronously; ignore a stale one that arrives after a quick reopen.
      onClose={() => { if (dialog.current?.open) return; setOpen(false); setQuery(""); setActive(0); }}
      onClick={(e) => { if (e.target === dialog.current) setOpen(false); }}
    >
      <div className="command-input">
        <Search className="ic" aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          aria-label="Search pages, courses and actions"
          placeholder="Search pages, courses and actions"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
          }}
        />
        <kbd>esc</kbd>
      </div>
      <ul id="command-list" role="listbox" aria-label="Results" className="command-list">
        {results.length === 0 ? <li className="command-empty" role="presentation">No matches. Try a page or course name.</li> : null}
        {results.map((c, i) => {
          const header = c.group !== lastGroup ? (lastGroup = c.group) : null;
          const Icon = c.icon;
          return (
            <li key={c.id} role="presentation">
              {header ? <div className="command-group" role="presentation">{header}</div> : null}
              <div
                id={`cmd-${c.id}`}
                role="option"
                aria-selected={i === active}
                className={`command-item${i === active ? " active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c)}
              >
                <Icon className="ic" aria-hidden="true" />
                <span>{c.label}</span>
                {i === active ? <CornerDownLeft className="ic enter" aria-hidden="true" /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
