export default function StatusBar({ message, updatedAt }: { message: string; updatedAt: string }) {
  return (
    <div className="status-bar">
      <div className="status-bar-dot" />
      <div style={{ flex: 1 }}>
        <div className="status-bar-label">Current step</div>
        <div className="status-bar-message">{message}</div>
      </div>
      <div style={{ fontSize: 11, color: "#92400e", textAlign: "right" }}>{timeSince(updatedAt)}</div>
    </div>
  );
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
