/** Tiny single-series trend line (decorative summary; the numbers are stated in text next to it). */
export default function Sparkline({ values, label }: { values: number[]; label: string }) {
  const W = 220;
  const H = 64;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const points = values.map((v, i) => [i * step, H - 6 - (v / max) * (H - 12)] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path className="area" d={`${line} L${W},${H} L0,${H} Z`} />
      <path className="line" d={line} />
    </svg>
  );
}
