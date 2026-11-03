export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading…</span>
      <div className="skeleton" style={{ height: 22, width: 180, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 52, width: "min(560px, 90%)", marginBottom: 28 }} />
      <div className="stat-row">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" style={{ height: 128 }} />)}
      </div>
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  );
}
