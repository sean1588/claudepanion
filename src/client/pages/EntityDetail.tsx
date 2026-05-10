import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useEntity } from "../hooks/useEntity";
import { useMcpStatus } from "../hooks/useMcpStatus";
import StatusPill from "../components/StatusPill";
import SlashCommandBlock from "../components/SlashCommandBlock";
import StatusBar from "../components/StatusBar";
import LogsPanel from "../components/LogsPanel";
import ContinuationForm from "../components/ContinuationForm";
import StaleBadge from "../components/StaleBadge";
import Breadcrumb from "../components/Breadcrumb";
import BaseArtifactPanel from "../components/BaseArtifactPanel";
import { continueEntity, fetchCompanions } from "../api";
import type { Entity, Manifest } from "@shared/types";
import { getArtifactRenderer } from "../../../companions/client";
import { MarkdownArtifactPanel } from "../primitives/MarkdownArtifactPanel";

const STALE_MS = 10 * 60 * 1000;

export default function EntityDetail() {
  const { companion = "", id = "" } = useParams();
  const { entity, refetch } = useEntity(companion, id);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
  }, [companion]);

  if (!entity) {
    return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  }

  return (
    <>
      {manifest && <Breadcrumb manifest={manifest} trailing={entity.id} />}
      <div className="page-title">
        <div>
          <h1>{describeEntity(entity)}</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
            {subtitle(entity)} · ID <code>{entity.id}</code>
          </div>
        </div>
        <StatusPill status={entity.status} />
      </div>

      {entity.status === "pending" && <PendingBody entity={entity} />}
      {entity.status === "running" && (
        <RunningBody entity={entity} onRerun={async () => { await continueEntity(companion, id, "retry"); await refetch(); }} />
      )}
      {entity.status === "completed" && (
        <CompletedBody entity={entity} onContinue={async (text) => { await continueEntity(companion, id, text); await refetch(); }} />
      )}
      {entity.status === "error" && (
        <ErrorBody entity={entity} onRetry={async (hint) => { await continueEntity(companion, id, hint || "retry"); await refetch(); }} />
      )}
    </>
  );
}

function describeEntity(e: Entity): string {
  const input = e.input as any;
  // Prefer short identifiers (title, slug name, iterate target) over raw description.
  // Truncate long descriptions so the h1 doesn't become a paragraph.
  const raw: string = input?.title ?? input?.name ?? input?.target ?? input?.description ?? e.companion;
  return raw.length > 60 ? raw.slice(0, 57) + "…" : raw;
}

function subtitle(e: Entity): string {
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

function slashCommand(e: Entity): string {
  return `/${e.companion}-companion ${e.id}`;
}

// Grace period after entity creation before we trust the "no MCP traffic" signal.
// Covers boot time for the user opening Claude Code + the initialize handshake.
const MCP_GRACE_MS = 15_000;

function PendingBody({ entity }: { entity: Entity }) {
  const note = entity.companion === "build"
    ? "Heads-up: start your Claude Code session inside the claudepanion repo, and make sure the plugin is installed (`claudepanion plugin install` in this repo, then restart Claude Code). Build scaffolds files into companions/ and skills/ relative to Claude's working directory."
    : undefined;
  const mcp = useMcpStatus(true);
  const ageMs = Date.now() - new Date(entity.createdAt).getTime();
  const showStuck = !mcp.loading && mcp.firstRequestAt === null && ageMs > MCP_GRACE_MS;
  return (
    <>
      <SlashCommandBlock command={slashCommand(entity)} note={note} />
      {showStuck && <McpStuckBanner />}
      <InputPanel entity={entity} />
      <LogsPanel logs={[]} waiting />
    </>
  );
}

function McpStuckBanner() {
  return (
    <div role="alert" style={{
      padding: "12px 16px",
      background: "#fef3c7",
      border: "1px solid #f59e0b",
      borderRadius: 8,
      fontSize: 13,
      color: "#78350f",
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        ⚠ claudepanion hasn't seen any MCP connection
      </div>
      <div>
        No MCP client has contacted this server yet. Start a Claude Code session in your repo and the
        connection should establish on its own. If it doesn't, try these in order:
      </div>
      <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
        <li>Run <code>/mcp</code> in your Claude Code session — confirm <code>claudepanion</code> is listed and not errored.</li>
        <li>Re-install the plugin in the repo Claude Code is running from: <code>claudepanion plugin install</code>.</li>
        <li>Rebuild the claudepanion checkout: <code>npm run build</code>.</li>
        <li>Start a <strong>new</strong> Claude Code session (plugins load at session start, not mid-session).</li>
      </ol>
    </div>
  );
}

function RunningBody({ entity, onRerun }: { entity: Entity; onRerun: () => void }) {
  const stale = Date.now() - new Date(entity.updatedAt).getTime() > STALE_MS;
  return (
    <>
      {stale && <StaleBadge updatedAt={entity.updatedAt} onRerun={onRerun} />}
      {entity.statusMessage && <StatusBar message={entity.statusMessage} updatedAt={entity.updatedAt} />}
      <div className="panel" style={{ padding: "10px 14px", display: "flex", gap: 12, fontSize: 13, background: "#f8fafc" }}>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>Slash command</span>
        <code style={{ background: "var(--code-bg)", color: "#e2e8f0", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>{slashCommand(entity)}</code>
      </div>
      <InputPanel entity={entity} collapsed />
      <LogsPanel logs={entity.logs} polling />
    </>
  );
}

function CompletedBody({ entity, onContinue }: { entity: Entity; onContinue: (text: string) => void }) {
  const Renderer = getArtifactRenderer(entity.companion);
  return (
    <>
      <div className="artifact-hero">
        <div className="artifact-hero-header">
          <div className="artifact-hero-label">Artifact</div>
          <div className="artifact-hero-title">Completed</div>
        </div>
        <div className="artifact-hero-body">
          <BaseArtifactPanel entity={entity}>
            {Renderer ? <Renderer entity={entity} /> : entity.artifact ? <MarkdownArtifactPanel artifact={entity.artifact as any} /> : <pre>{JSON.stringify(entity.artifact, null, 2)}</pre>}
          </BaseArtifactPanel>
        </div>
      </div>
      <ContinuationForm
        title="Not quite right? Ask Claude to revise."
        hint="Describe what to change and get a new slash command. The artifact above is kept as context."
        cta="Continue"
        placeholder="e.g. 'redo with a tighter summary'"
        onSubmit={onContinue}
      />
      <InputPanel entity={entity} collapsed />
    </>
  );
}

function ErrorBody({ entity, onRetry }: { entity: Entity; onRetry: (hint: string) => void }) {
  return (
    <>
      <div className="error-hero">
        <div className="error-hero-header">
          <div className="error-hero-label">Error</div>
          <div className="error-hero-message">{entity.errorMessage}</div>
        </div>
        {entity.errorStack && <pre className="error-hero-stack">{entity.errorStack}</pre>}
      </div>
      <ContinuationForm
        title="Try again with a hint"
        hint="Describe a workaround. The original input is preserved."
        cta="Retry"
        placeholder="e.g. 'skip OCR, amount is $142.80'"
        onSubmit={onRetry}
      />
      <LogsPanel logs={entity.logs} />
      <InputPanel entity={entity} collapsed />
    </>
  );
}

function InputPanel({ entity, collapsed }: { entity: Entity; collapsed?: boolean }) {
  return (
    <details open={!collapsed} className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <summary className="panel-header" style={{ cursor: "pointer", listStyle: "revert" }}>
        Input
        {collapsed && (
          <span style={{ marginLeft: 12, fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>
            {JSON.stringify(entity.input).slice(0, 120)}
          </span>
        )}
      </summary>
      <div className="panel-body">
        <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(entity.input, null, 2)}</pre>
      </div>
    </details>
  );
}
