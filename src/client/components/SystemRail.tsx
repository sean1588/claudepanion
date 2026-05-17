import { useHealth } from "../hooks/useHealth";

type Dot = "ok" | "warn" | "muted";

function dotColor(d: Dot): string {
  if (d === "ok") return "var(--status-success)";
  if (d === "warn") return "var(--status-error)";
  return "var(--muted)";
}

export default function SystemRail() {
  const health = useHealth();
  const host: Dot = "ok";
  const mcp: Dot = mcpDot(health);
  const plugin: Dot = pluginDot(health);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Row dot={host} label="host running" />
      <Row dot={mcp} label="MCP /mcp open" title={mcpTitle(mcp)} />
      <Row dot={plugin} label="plugin installed" title={pluginTitle(plugin, health)} />
    </div>
  );
}

function Row({ dot, label, title }: { dot: Dot; label: string; title?: string }) {
  return (
    <div title={title} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor(dot), flex: "0 0 8px" }} />
      <span>{label}</span>
    </div>
  );
}

function mcpDot(h: ReturnType<typeof useHealth>): Dot {
  if (!h) return "muted";
  if (h.mcp.firstRequestAt) return "ok";
  return "warn";
}

function mcpTitle(d: Dot): string {
  if (d === "ok") return "MCP traffic seen";
  if (d === "warn") return "No MCP traffic yet — run /mcp in your Claude session";
  return "Loading…";
}

function pluginDot(h: ReturnType<typeof useHealth>): Dot {
  if (!h) return "muted";
  if (h.pluginInstalled === true) return "ok";
  if (h.pluginInstalled === false) return "warn";
  return "muted";
}

function pluginTitle(d: Dot, h: ReturnType<typeof useHealth>): string {
  if (d === "muted" && h?.pluginInstalled === null) return "Plugin install state unknown";
  if (d === "ok") return "claudepanion plugin enabled";
  if (d === "warn") return "claudepanion plugin not enabled — run `claudepanion plugin install`";
  return "Loading…";
}
