import Link from "next/link";
import { AlertTriangle, Info, type LucideIcon, OctagonAlert } from "lucide-react";

type ButtonVariant = "primary" | "ghost" | "default";

export function buttonClass(variant: ButtonVariant = "default", small = false) {
  return ["btn", variant === "default" ? "" : variant, small ? "small" : ""].filter(Boolean).join(" ");
}

export function ButtonLink({
  href,
  variant,
  small,
  children,
  ...rest
}: { href: string; variant?: ButtonVariant; small?: boolean; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={buttonClass(variant, small)} {...rest}>
      {children}
    </Link>
  );
}

export function Chip({ tone, children }: { tone?: "good" | "warn" | "danger"; children: React.ReactNode }) {
  return <span className={["chip", tone].filter(Boolean).join(" ")}>{children}</span>;
}

/** A metric tile. `value === null` renders an explicit "no data" state instead of a number. */
export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  caption: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="label">{label}</span>
        {Icon ? <div className="stat-icon"><Icon className="ic" aria-hidden="true" /></div> : null}
      </div>
      {value === null ? <strong className="unknown" aria-label="No data yet">—</strong> : <strong>{value}</strong>}
      <p>{caption}</p>
    </div>
  );
}

export function ProgressArc({ percent, caption }: { percent: number | null; caption: string }) {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className={`progress-arc${percent === null ? " empty" : ""}`}
      style={{ "--value": value } as React.CSSProperties}
      role="img"
      aria-label={percent === null ? `${caption}: no data yet` : `${caption}: ${value}%`}
    >
      <div>
        <strong>{percent === null ? "—" : `${value}%`}</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}

export function EmptyCard({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card empty-card">
      <div className="empty-icon"><Icon className="ic" aria-hidden="true" /></div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Notice({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "info" | "danger";
  title: string;
  children?: React.ReactNode;
}) {
  const Icon = tone === "info" ? Info : tone === "danger" ? OctagonAlert : AlertTriangle;
  return (
    <div className={`notice ${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon className="ic" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}
