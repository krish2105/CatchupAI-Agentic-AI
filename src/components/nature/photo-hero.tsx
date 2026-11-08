/**
 * Hero card over the Nature Flow panorama (alpine morning in light, moonlit lake in dark).
 * The image is decorative CSS background art; a theme-coloured fade keeps the text side readable.
 */
export default function PhotoHero({ labelledBy, label, aside, children }: { labelledBy: string; label?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={aside ? "photo-hero has-aside" : "photo-hero"} aria-labelledby={label ? undefined : labelledBy} aria-label={label}>
      <div className="photo-hero-art" aria-hidden="true" />
      <div className="photo-hero-copy">{children}</div>
      {aside ? <div className="photo-hero-aside">{aside}</div> : null}
    </section>
  );
}
