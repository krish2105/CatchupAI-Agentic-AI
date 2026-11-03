/** Small decorative hills-and-pines strip used at the foot of the sidebar. */
const PINES = [8, 22, 34, 52, 70, 86, 104, 122, 140, 158, 176, 196, 214, 232]
  .map((x, i) => {
    const h = 18 + ((i * 37) % 22);
    const base = 92 + ((i * 13) % 10);
    return `M${x},${base - h} L${x + h * 0.18},${base} L${x - h * 0.18},${base} Z`;
  })
  .join(" ");

export default function PineRidge() {
  return (
    <svg className="side-ridge" viewBox="0 0 248 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <path d="M0,70 C40,52 80,62 120,50 C160,40 200,56 248,46 L248,120 L0,120 Z" style={{ fill: "var(--land-far)" }} opacity="0.55" />
      <path d="M0,92 C50,80 110,92 160,84 C200,78 228,86 248,82 L248,120 L0,120 Z" style={{ fill: "var(--land-mid)" }} opacity="0.7" />
      <path d={PINES} style={{ fill: "var(--land-tree)" }} opacity="0.75" />
      <path d="M0,104 C60,98 140,108 248,100 L248,120 L0,120 Z" style={{ fill: "var(--land-near)" }} opacity="0.8" />
    </svg>
  );
}
