import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useEntityPolling } from "../hooks/useEntityPolling";
import { useMcpStatus } from "../hooks/useMcpStatus";
import { fetchCompanions, continueEntity } from "../api";
import { deriveSteps, type DerivedStep } from "../lib/buildSteps";
import BaseArtifactPanel from "../components/BaseArtifactPanel";
import ContinuationForm from "../components/ContinuationForm";
import { MarkdownArtifactPanel } from "../primitives/MarkdownArtifactPanel";
import { getArtifactRenderer } from "../../../companions/client";
import type { Entity, Manifest } from "@shared/types";

const MCP_GRACE_MS = 15_000;

export default function EntityDetail() {
  const { companion = "", id = "" } = useParams();
  const { entity } = useEntityPolling(companion, id);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => { void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null)); }, [companion]);

  if (!entity) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const isBuild = entity.companion === "build";
  const steps = isBuild ? deriveSteps(entity) : null;
  const latestLine = entity.logs?.at(-1)?.message;

  return (
    <div style={{ maxWidth: 980, display: "flex", flexDirection: "column", gap: 32 }}>
      <Breadcrumb manifest={manifest} entityId={entity.id} />

      <Header entity={entity} />

      {entity.status === "pending" && <PendingBanner entity={entity} />}
      {latestLine && entity.status !== "completed" && entity.status !== "error" && (
        <StatusMonoBlock text={latestLine} />
      )}

      <SlashRow entity={entity} />

      {steps && <StepList steps={steps} />}

      <LogPane logs={(entity.logs ?? []).map((l) => l.message)} polling={entity.status === "running" || entity.status === "pending"} />

      {entity.status === "completed" && <CompletedArtifact entity={entity} />}
      {entity.status === "error" && <ErrorPanel entity={entity} />}

      <FooterBar entity={entity} />

      <ContinuationFormSection entity={entity} />
    </div>
  );
}

function Breadcrumb({ manifest, entityId }: { manifest: Manifest | null; entityId: string }) {
  return (
    <div className="t-mono" style={{ color: "var(--muted)" }}>
      <Link to="/" style={{ color: "var(--muted)", textDecoration: "none" }}>claudepanion</Link>
      {manifest && <> › <Link to={`/c/${manifest.name}`} style={{ color: "var(--muted)", textDecoration: "none" }}>{manifest.displayName}</Link></>}
      {" › "}
      <span>{entityId}</span>
    </div>
  );
}

function Header({ entity }: { entity: Entity }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h1 className="t-display-sm" style={{ margin: 0 }}>{titleOf(entity)}</h1>
      <div className="t-caption">
        {subtitleOf(entity)} · ID <code>{entity.id}</code>
        <StatusInline status={entity.status} />
      </div>
    </header>
  );
}

function StatusInline({ status }: { status: Entity["status"] }) {
  const color = statusColor(status);
  return <span style={{ marginLeft: 12, color }}>● {status}</span>;
}

function StatusMonoBlock({ text }: { text: string }) {
  return (
    <div className="panel-mono" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--status-info)" }} />
      <span className="t-eyebrow" style={{ color: "var(--bg)" }}>Running</span>
      <span style={{ opacity: 0.8 }}>{text}</span>
    </div>
  );
}

function SlashRow({ entity }: { entity: Entity }) {
  const cmd = `/${entity.companion}-companion ${entity.id}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — leave the code visible */ }
  };
  return (
    <div className="card-hairline" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className="t-caption" style={{ color: "var(--muted)" }}>Slash command</span>
      <code className="t-mono" style={{ background: "var(--ink)", color: "var(--bg)", padding: "6px 12px", borderRadius: 6, flex: 1 }}>{cmd}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy slash command"}
        className="t-caption"
        style={{
          background: "transparent",
          border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
          color: copied ? "var(--status-success)" : "var(--ink)",
          padding: "6px 10px",
          borderRadius: 6,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
        }}
      >
        {copied ? "✓ copied" : "copy"}
      </button>
    </div>
  );
}

function StepList({ steps }: { steps: DerivedStep[] }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((s) => (
        <li key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StepIcon status={s.status} />
          <span style={{ color: s.status === "pending" ? "var(--muted)" : "var(--ink)" }}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ status }: { status: DerivedStep["status"] }) {
  if (status === "done") return <span style={{ color: "var(--status-success)" }}>✓</span>;
  if (status === "failed") return <span style={{ color: "var(--status-error)" }}>×</span>;
  if (status === "active") return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--status-info)", animation: "pulse 1.2s ease-in-out infinite" }} />;
  return <span style={{ color: "var(--muted)" }}>○</span>;
}

function LogPane({ logs, polling }: { logs: string[]; polling: boolean }) {
  return (
    <section className="panel-mono" style={{ background: "var(--ink)", borderRadius: 8 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid color-mix(in srgb, var(--bg) 12%, transparent)" }}>
        <span className="t-eyebrow" style={{ color: "var(--bg)" }}>Logs</span>
        {polling && <span className="t-caption" style={{ color: "var(--bg)", opacity: 0.6 }}>· polling every 2s</span>}
      </header>
      <pre style={{ margin: 0, padding: 12, fontSize: 12, color: "var(--bg)", whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto" }}>
        {logs.length === 0 ? "Waiting for agent…" : logs.join("\n")}
      </pre>
    </section>
  );
}

function PendingBanner({ entity }: { entity: Entity }) {
  const mcp = useMcpStatus(true);
  const ageMs = Date.now() - new Date(entity.createdAt).getTime();
  const stuck = !mcp.loading && mcp.firstRequestAt === null && ageMs > MCP_GRACE_MS;
  if (!stuck) return null;
  return (
    <div role="alert" className="card-hairline" style={{ borderColor: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 8%, transparent)" }}>
      <strong>⚠ claudepanion hasn't seen any MCP connection.</strong>
      <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
        <li>Run <code>/mcp</code> in your Claude Code session.</li>
        <li><code>claudepanion plugin install</code> in your repo.</li>
        <li>Restart your Claude Code session.</li>
      </ol>
      <p className="t-caption" style={{ margin: "8px 0 0", color: "var(--muted)" }}>
        Still stuck? The claudepanion server itself may have died — stop <code>claudepanion serve</code> and run it again.
      </p>
    </div>
  );
}

function CompletedArtifact({ entity }: { entity: Entity }) {
  const Renderer = getArtifactRenderer(entity.companion);
  return (
    <section className="card-hairline">
      <span className="t-eyebrow">Artifact</span>
      <BaseArtifactPanel entity={entity}>
        {Renderer ? <Renderer entity={entity} /> : entity.artifact ? <MarkdownArtifactPanel artifact={entity.artifact as any} /> : <pre>{JSON.stringify(entity.artifact, null, 2)}</pre>}
      </BaseArtifactPanel>
    </section>
  );
}

function ErrorPanel({ entity }: { entity: Entity }) {
  return (
    <section className="card-hairline" style={{ borderColor: "var(--status-error)" }}>
      <span className="t-eyebrow" style={{ color: "var(--status-error)" }}>Error</span>
      <p style={{ marginTop: 4 }}>{entity.errorMessage ?? "Unknown error"}</p>
      {entity.errorStack && <pre className="t-mono" style={{ fontSize: 12, maxHeight: 200, overflow: "auto", marginTop: 8 }}>{entity.errorStack}</pre>}
      <p className="t-caption" style={{ margin: "8px 0 0", color: "var(--muted)" }}>
        If this started failing after a rebuild or new companion, the claudepanion server may need a restart — stop <code>claudepanion serve</code> and run it again.
      </p>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="button" className="btn-ink" onClick={() => void continueEntity(entity.companion, entity.id, "retry")}>Retry build</button>
        <Link to={`/c/build/iterate/${entity.companion}`} className="btn-ghost">Edit prompt</Link>
      </div>
    </section>
  );
}

function FooterBar({ entity }: { entity: Entity }) {
  const targetSlug = (entity.input as Record<string, unknown>).name as string | undefined;
  const enabled = entity.status === "completed" && entity.companion === "build" && targetSlug;
  return (
    <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)" }}>
      <Link to={`/c/${entity.companion}`} className="t-caption" style={{ color: "var(--muted)" }}>← Back</Link>
      <Link
        to={enabled ? `/c/${targetSlug}` : "#"}
        className="btn-ink"
        aria-disabled={enabled ? undefined : "true"}
        tabIndex={enabled ? undefined : -1}
        style={{ pointerEvents: enabled ? "auto" : "none", opacity: enabled ? 1 : 0.4 }}
      >
        Open companion →
      </Link>
    </footer>
  );
}

function ContinuationFormSection({ entity }: { entity: Entity }) {
  if (entity.status === "completed") {
    return (
      <ContinuationForm
        title="Not quite right? Ask Claude to revise."
        hint="Describe what to change and get a new slash command. The artifact above is kept as context."
        cta="Continue"
        placeholder="e.g. 'redo with a tighter summary'"
        onSubmit={async (text) => { await continueEntity(entity.companion, entity.id, text); }}
      />
    );
  }
  return null;
}

function titleOf(e: Entity): string {
  const input = e.input as Record<string, unknown>;
  const raw = (input.title ?? input.name ?? input.target ?? input.description ?? e.companion) as string;
  return raw.length > 60 ? raw.slice(0, 57) + "…" : raw;
}

function subtitleOf(e: Entity): string {
  if (e.status === "pending") return `Created ${timeAgo(e.createdAt)}`;
  if (e.status === "running") return `Started ${timeAgo(e.createdAt)}`;
  if (e.status === "completed") return `Completed · took ${duration(e.createdAt, e.updatedAt)}`;
  return `Failed · ran for ${duration(e.createdAt, e.updatedAt)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function duration(from: string, to: string): string {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function statusColor(status: Entity["status"]): string {
  if (status === "completed") return "var(--status-success)";
  if (status === "running") return "var(--status-info)";
  if (status === "error") return "var(--status-error)";
  return "var(--status-warning)";
}
