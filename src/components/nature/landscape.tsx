/**
 * Theme-aware alpine landscape (inline SVG, no image download). Colours come from the --land-* tokens so
 * the same scene renders as an alpine morning (light) or a moonlit forest (dark). Purely decorative.
 * Generated photographic panoramas can replace it later without changing any layout.
 */

/** Deterministic pine silhouettes along a ridge line. */
function pines(seed: number, count: number, xStart: number, xEnd: number, baseY: number, height: number) {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, () => {
    const x = xStart + rand() * (xEnd - xStart);
    const h = height * (0.55 + rand() * 0.6);
    const w = h * 0.34;
    const y = baseY + rand() * 14;
    return `M${x.toFixed(1)},${(y - h).toFixed(1)} L${(x + w / 2).toFixed(1)},${y.toFixed(1)} L${(x - w / 2).toFixed(1)},${y.toFixed(1)} Z`;
  }).join(" ");
}

const FAR_PINES = pines(7, 90, 0, 1200, 262, 26);
const NEAR_PINES = pines(19, 46, 700, 1200, 304, 64);
const FRAME_PINES = pines(43, 12, 1090, 1200, 330, 120);
const LEFT_PINES = pines(31, 14, 0, 260, 300, 46);

export default function Landscape({ className = "landscape" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--land-sky1)" }} />
          <stop offset="1" style={{ stopColor: "var(--land-sky2)" }} />
        </linearGradient>
        <linearGradient id="nf-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--land-lake1)" }} />
          <stop offset="1" style={{ stopColor: "var(--land-lake2)" }} />
        </linearGradient>
        <linearGradient id="nf-far" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--land-far2)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--land-far)" }} />
          <stop offset="1" style={{ stopColor: "var(--land-far2)" }} />
        </linearGradient>
        <radialGradient id="nf-sun-glow">
          <stop offset="0" style={{ stopColor: "var(--land-sun-glow)" }} />
          <stop offset="1" style={{ stopColor: "var(--land-sun-glow)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <rect width="1200" height="420" fill="url(#nf-sky)" />
      <circle cx="720" cy="92" r="120" fill="url(#nf-sun-glow)" />
      <circle cx="720" cy="92" r="30" style={{ fill: "var(--land-sun)" }} />
      <path d="M0,250 L120,190 L210,214 L330,130 L420,186 L520,150 L640,96 L760,170 L860,120 L980,182 L1080,140 L1200,196 L1200,300 L0,300 Z" fill="url(#nf-far)" />
      <path d="M640,96 L600,150 L626,140 L612,186 L652,150 L660,176 L700,138 Z M860,120 L830,168 L852,160 L844,190 L874,160 L900,158 Z M330,130 L300,178 L322,170 L316,200 L346,172 L372,170 Z" style={{ fill: "var(--land-far2)" }} opacity="0.5" />
      <path d="M640,96 L604,128 L622,124 L640,140 L660,122 L676,130 Z M860,120 L834,140 L850,138 L862,150 L874,138 L888,142 Z M330,130 L304,152 L318,150 L332,162 L346,150 L358,154 Z" style={{ fill: "var(--land-snow)" }} />
      <g className="mist">
        <ellipse cx="420" cy="238" rx="360" ry="22" style={{ fill: "var(--land-mist)" }} />
        <ellipse cx="980" cy="226" rx="300" ry="18" style={{ fill: "var(--land-mist)" }} />
      </g>
      <path d="M0,282 L160,236 L300,262 L460,222 L600,258 L760,226 L920,256 L1060,232 L1200,250 L1200,320 L0,320 Z" style={{ fill: "var(--land-mid)" }} />
      <path d={FAR_PINES} style={{ fill: "var(--land-near)" }} />
      <rect y="300" width="1200" height="120" fill="url(#nf-lake)" />
      <g style={{ stroke: "var(--land-shine)" }} strokeWidth="2" strokeLinecap="round">
        <path d="M880,322 h100 M900,336 h64 M870,350 h120 M914,364 h40" />
        <path d="M180,346 h70 M420,330 h40 M600,372 h90" opacity="0.6" />
      </g>
      <path d="M560,420 C700,372 900,352 1200,340 L1200,420 Z" style={{ fill: "var(--land-near)" }} />
      <path d={NEAR_PINES} style={{ fill: "var(--land-tree)" }} />
      <path d={FRAME_PINES} style={{ fill: "var(--land-tree)" }} />
      <path d={LEFT_PINES} style={{ fill: "var(--land-tree)" }} opacity="0.85" />
    </svg>
  );
}
