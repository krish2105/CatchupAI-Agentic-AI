import Link from "next/link";

export default function Brand({ href = "/", caption = true }: { href?: string; caption?: boolean }) {
  return (
    <Link href={href} className="brand" aria-label="CatchUp AI home">
      <span className="brandmark" aria-hidden="true" />
      <span>
        <span className="brand-name">catchup<span>.ai</span></span>
        {caption ? <span className="brand-caption" style={{ display: "block" }}>ORBITAL ATELIER</span> : null}
      </span>
    </Link>
  );
}
