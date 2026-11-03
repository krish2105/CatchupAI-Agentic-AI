/**
 * Hero card over the Nature Flow panorama (alpine morning in light, moonlit lake in dark).
 * The image is decorative CSS background art; a theme-coloured fade keeps the text side readable.
 */
export default function PhotoHero({ labelledBy, label, children }: { labelledBy: string; label?: string; children: React.ReactNode }) {
  return (
    <section className="photo-hero" aria-labelledby={label ? undefined : labelledBy} aria-label={label}>
      <div className="photo-hero-art" aria-hidden="true" />
      <div className="photo-hero-copy">{children}</div>
    </section>
  );
}
