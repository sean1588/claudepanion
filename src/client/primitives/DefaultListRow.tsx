import type { Entity, BaseArtifact } from "../../shared/types.js";

interface Props {
  entity: Entity<unknown, BaseArtifact>;
}

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  pending: { fg: "#475569", bg: "#e2e8f0" },
  running: { fg: "#1e40af", bg: "#dbeafe" },
  completed: { fg: "#166534", bg: "#dcfce7" },
  error: { fg: "#991b1b", bg: "#fee2e2" },
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function DefaultListRow({ entity }: Props) {
  const colors = STATUS_COLORS[entity.status] ?? STATUS_COLORS.pending;
  const summary = entity.artifact?.summary ?? "<pending>";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{
        background: colors.bg,
        color: colors.fg,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        whiteSpace: "nowrap",
      }}>
        {entity.status}
      </span>
      <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{entity.id}</span>
      <span style={{
        color: "var(--muted)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: 1,
      }}>
        {summary}
      </span>
      <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
        {relativeTime(entity.updatedAt)}
      </span>
    </div>
  );
}

export default DefaultListRow;
