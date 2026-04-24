import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useEntity } from "../hooks/useEntity";
import StatusPill from "../components/StatusPill";
import SlashCommandBlock from "../components/SlashCommandBlock";
import StatusBar from "../components/StatusBar";
import LogsPanel from "../components/LogsPanel";
import ContinuationForm from "../components/ContinuationForm";
import StaleBadge from "../components/StaleBadge";
import Breadcrumb from "../components/Breadcrumb";
import { continueEntity, fetchCompanions } from "../api";
import type { Entity, Manifest } from "@shared/types";
import { getArtifactRenderer } from "../../../companions/client";

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
  return input?.title ?? input?.description ?? e.companion;
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

function PendingBody({ entity }: { entity: Entity }) {
  const note = entity.companion === "build"
    ? "Heads-up: start your Claude Code session inside the claudepanion repo. Build needs to write files into companions/ and skills/ relative to Claude's working directory."
    : undefined;
  return (
    <>
      <SlashCommandBlock command={slashCommand(entity)} note={note} />
      <InputPanel entity={entity} />
      <LogsPanel logs={[]} waiting />
    </>
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
          {Renderer ? <Renderer entity={entity} /> : <pre>{JSON.stringify(entity.artifact, null, 2)}</pre>}
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
