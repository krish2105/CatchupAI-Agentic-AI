import Link from "next/link";
import { MountainSnow } from "lucide-react";

export default function Brand({ href = "/", caption = true }: { href?: string; caption?: boolean }) {
  return (
    <Link href={href} className="brand" aria-label="CatchUp AI home">
      <span className="brandmark" aria-hidden="true"><MountainSnow strokeWidth={1.8} /></span>
      <span>
        <span className="brand-name">catchup<span>.ai</span></span>
        {caption ? <span className="brand-caption" style={{ display: "block" }}>NATURE FLOW</span> : null}
      </span>
    </Link>
  );
}
