import Link from "next/link";
import { MountainSnow } from "lucide-react";

export default function Brand({ href = "/", caption = true }: { href?: string; caption?: boolean }) {
  return (
    // The accessible name comes from the visible text plus "home", so voice control users can say what they see (WCAG 2.5.3).
    <Link href={href} className="brand">
      <span className="brandmark" aria-hidden="true"><MountainSnow strokeWidth={1.8} /></span>
      <span>
        <span className="brand-name">catchup<span>.ai</span></span>
        {caption ? <span className="brand-caption" style={{ display: "block" }}>NATURE FLOW</span> : null}
        <span className="visually-hidden"> home</span>
      </span>
    </Link>
  );
}
