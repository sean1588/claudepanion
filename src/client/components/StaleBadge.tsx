export default function StaleBadge({ updatedAt, onRerun }: { updatedAt: string; onRerun: () => void }) {
  const minutes = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60_000);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
      <span className="stale-badge">last activity {minutes}m ago</span>
      <button className="btn btn-secondary" onClick={onRerun}>looks stalled — re-run?</button>
    </div>
  );
}
