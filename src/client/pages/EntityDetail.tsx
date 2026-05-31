import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useEntityPolling } from "../hooks/useEntityPolling";
import { useMcpStatus } from "../hooks/useMcpStatus";
import { fetchCompanions, continueEntity } from "../api";
import { deriveSteps, type DerivedStep } from "../lib/buildSteps";
import { MarkdownArtifactPanel } from "../primitives/MarkdownArtifactPanel";
import { getArtifactRenderer } from "../../../companions/client";
import type { Entity, Manifest } from "@shared/types";

const MCP_GRACE_MS = 15_000;

export default function EntityDetail() {
  const { companion = "", id = "" } = useParams();
  const { entity } = useEntityPolling(companion, id);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
  }, [companion]);

  if (!entity) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;

  const isBuild = entity.companion === "build";
  const steps = isBuild ? deriveSteps(entity) : null;
  // Headless companions are driven by the host — no slash command to hand off.
  const headless = manifest?.execution === "headless";

  return (
    <div style={{ padding: "22px 28px 60px", maxWidth: 1100 }}>
      <Title entity={entity} headless={headless} />

      {entity.status === "pending" && (
        <>
          {headless ? (
            <HeadlessHero />
          ) : (
            <>
              <PendingBanner entity={entity} />
              <SlashHero entity={entity} />
            </>
          )}
          <LogsCard entity={entity} pending headless={headless} />
        </>
      )}

      {entity.status === "running" && (
        <>
          <RunningStatus entity={entity} steps={steps} />
          {!headless && <SlashCollapsed entity={entity} />}
          <LogsCard entity={entity} />
          {steps && <StepsCard steps={steps} />}
        </>
      )}

      {entity.status === "completed" && (
        <>
          <CompletedArtifact entity={entity} manifest={manifest} />
          <ContinueCard entity={entity} />
        </>
      )}

      {entity.status === "error" && (
        <>
          <ErrorCard entity={entity} />
          <RetryCard entity={entity} />
          <LogsCard entity={entity} />
        </>
      )}
    </div>
  );
}

function Title({ entity, headless = false }: { entity: Entity; headless?: boolean }) {
  const subline = (() => {
    if (entity.status === "pending") return headless ? `starting headless run` : `waiting for handoff`;
    if (entity.status === "running") return `claude is working`;
    if (entity.status === "completed") return `scaffold complete`;
    return `build failed`;
  })();
  const sub = entity.status === "pending" ? `created ${timeAgo(entity.createdAt)} · ${entity.id}`
    : entity.status === "running" ? `started ${timeAgo(entity.createdAt)} · ${entity.id}`
    : entity.status === "completed" ? `completed · took ${duration(entity.createdAt, entity.updatedAt)} · ${entity.id}`
    : `failed · ran for ${duration(entity.createdAt, entity.updatedAt)} · ${entity.id}`;
  return (
    <header style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div className="wb-section-label" style={{ marginBottom: 8 }}>{subline}</div>
        <h1 className="wb-serif" style={{ fontSize: 44, lineHeight: 1.05, margin: "0 0 6px" }}>
          {titleOf(entity)}
        </h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{sub}</div>
      </div>
      <StatusPill status={entity.status} />
    </header>
  );
}

function StatusPill({ status }: { status: Entity["status"] }) {
  const color =
    status === "pending" ? "var(--status-warning)"
    : status === "running" ? "var(--accent)"
    : status === "completed" ? "var(--sage)"
    : "var(--status-error)";
  return (
    <span
      style={{
        padding: "4px 12px",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: `1px solid ${color}`,
        color,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
      {status}
    </span>
  );
}

function SlashHero({ entity }: { entity: Entity }) {
  const cmd = `/${entity.companion}-companion ${entity.id}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };
  return (
    <div className="wb-card" style={{ marginBottom: 12, borderColor: "var(--sage)" }}>
      <div
        className="wb-card-header wb-section-label"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "var(--sage)",
          background: "color-mix(in srgb, var(--sage) 10%, transparent)",
          borderBottomColor: "var(--sage)",
        }}
      >
        <span>hand off to claude</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="wb-pulse" style={{ background: "var(--sage)" }} />polling every 2s
        </span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="wb-sans" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Paste in Claude Code to start work on this entity:
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="wb-code" style={{ flex: 1, fontSize: 13, display: "flex", alignItems: "center", padding: "12px 14px" }}>
            {cmd}
          </div>
          <button onClick={copy} className="wb-btn" style={{ padding: "0 16px" }}>
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderLeft: "2px solid var(--sage)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.6,
            background: "var(--bg)",
          }}
        >
          // run claude code inside the claudepanion repo<br />
          // `claudepanion plugin install` must have been run first<br />
          // build writes to companions/ and skills/ from claude's cwd
        </div>
      </div>
    </div>
  );
}

function HeadlessHero() {
  return (
    <div className="wb-card" style={{ marginBottom: 12, borderColor: "var(--accent)" }}>
      <div
        className="wb-card-header wb-section-label"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "var(--accent)",
          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
          borderBottomColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
        }}
      >
        <span>running headlessly</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="wb-pulse" style={{ background: "var(--accent)" }} />polling every 2s
        </span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="wb-sans" style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
          claudepanion is running this companion for you — no terminal step. Claude works through this
          companion's tools and the result appears here when it's done.
        </div>
      </div>
    </div>
  );
}

function SlashCollapsed({ entity }: { entity: Entity }) {
  const cmd = `/${entity.companion}-companion ${entity.id}`;
  return (
    <div className="wb-card" style={{ marginBottom: 12, fontSize: 11 }}>
      <div style={{ padding: "8px 14px", display: "flex", gap: 14, alignItems: "center", fontFamily: "var(--font-mono)" }}>
        <span style={{ color: "var(--muted)" }}>slash command</span>
        <code className="wb-code" style={{ padding: "3px 10px", fontSize: 12 }}>{cmd}</code>
      </div>
    </div>
  );
}

function RunningStatus({ entity, steps }: { entity: Entity; steps: DerivedStep[] | null }) {
  const latest = entity.logs?.at(-1)?.message;
  const activeStep = steps?.find((s) => s.status === "active");
  return (
    <div
      className="wb-card"
      style={{
        marginBottom: 12,
        borderColor: "color-mix(in srgb, var(--accent) 55%, transparent)",
        background: "color-mix(in srgb, var(--accent) 6%, transparent)",
      }}
    >
      <div
        className="wb-card-header wb-section-label"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          color: "var(--accent)",
          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
          borderBottomColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
        }}
      >
        <span className="wb-pulse" style={{ background: "var(--accent)" }} />
        claude is running
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div className="wb-sans" style={{ fontSize: 14, color: "var(--ink)" }}>
          {activeStep ? activeStep.label : latest ?? "Working…"}
        </div>
        <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
          elapsed: {durationNow(entity.createdAt)}
        </div>
      </div>
    </div>
  );
}

function LogsCard({ entity, pending = false, headless = false }: { entity: Entity; pending?: boolean; headless?: boolean }) {
  const lines = (entity.logs ?? []).map((l) => l.message);
  const polling = entity.status === "running" || entity.status === "pending";
  if (pending && lines.length === 0) {
    return (
      <div className="wb-card" style={{ marginBottom: 12 }}>
        <div
          className="wb-card-header wb-section-label"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="wb-pulse" style={{ background: "var(--sage)" }} />logs
          </span>
          <span>0 entries</span>
        </div>
        <div
          style={{
            padding: "28px 14px",
            textAlign: "center",
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div>// waiting for claude to start…</div>
          <div>{headless ? "// claude is starting — logs stream here as it works" : "// logs stream here once the slash command is run"}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="wb-card" style={{ marginBottom: 12 }}>
      <div
        className="wb-card-header wb-section-label"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {polling && <span className="wb-pulse" style={{ background: "var(--accent)" }} />}
          logs{polling ? " · polling" : ""}
        </span>
        <span>{lines.length} {lines.length === 1 ? "entry" : "entries"}</span>
      </div>
      <pre
        className="wb-code"
        style={{
          margin: 0,
          padding: "10px 14px",
          maxHeight: 280,
          overflow: "auto",
          fontSize: 11,
          whiteSpace: "pre-wrap",
        }}
      >
        {lines.length === 0 ? "// no logs yet" : lines.join("\n")}
      </pre>
    </div>
  );
}

function StepsCard({ steps }: { steps: DerivedStep[] }) {
  return (
    <div className="wb-card" style={{ marginBottom: 12 }}>
      <div className="wb-card-header wb-section-label">steps</div>
      <ol style={{ listStyle: "none", padding: "10px 14px", margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((s) => (
          <li key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            <StepIcon status={s.status} />
            <span style={{ color: s.status === "pending" ? "var(--muted)" : "var(--ink)" }}>{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepIcon({ status }: { status: DerivedStep["status"] }) {
  if (status === "done") return <span style={{ color: "var(--sage)" }}>✓</span>;
  if (status === "failed") return <span style={{ color: "var(--status-error)" }}>×</span>;
  if (status === "active") return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "wb-pulse 1.2s infinite" }} />;
  return <span style={{ color: "var(--muted)" }}>○</span>;
}

function CompletedArtifact({ entity, manifest }: { entity: Entity; manifest: Manifest | null }) {
  const Renderer = getArtifactRenderer(entity.companion);
  const targetSlug = (entity.input as Record<string, unknown>).name as string | undefined;
  const canOpen = entity.companion === "build" && targetSlug;
  const filesCreated = filesFromArtifact(entity);
  return (
    <div className="wb-card" style={{ marginBottom: 12, borderColor: "var(--sage)" }}>
      <div
        className="wb-card-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "color-mix(in srgb, var(--sage) 12%, transparent)",
          borderBottomColor: "var(--sage)",
        }}
      >
        <span className="wb-section-label" style={{ color: "var(--sage)" }}>artifact · build complete</span>
        {canOpen && (
          <Link to={`/c/${targetSlug}`} className="wb-btn wb-btn-sm" style={{ textDecoration: "none" }}>
            open companion →
          </Link>
        )}
      </div>
      <div style={{ padding: 14 }}>
        {filesCreated && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 14 }}>
            <div>
              <div className="wb-section-label" style={{ marginBottom: 6 }}>files created</div>
              {filesCreated.created.map((f) => (
                <div key={f} style={{ color: "var(--sage)", lineHeight: 1.85 }}>+ {f}</div>
              ))}
            </div>
            <div>
              <div className="wb-section-label" style={{ marginBottom: 6 }}>files modified</div>
              {filesCreated.modified.map((f) => (
                <div key={f} style={{ color: "var(--muted)", lineHeight: 1.85 }}>~ {f}</div>
              ))}
              <div className="wb-section-label" style={{ marginTop: 14, marginBottom: 6 }}>next step</div>
              <div className="wb-sans" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                Companion mounted in sidebar → click to open → fill the form → run it.
              </div>
            </div>
          </div>
        )}
        <div style={{ borderTop: "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)", paddingTop: 14 }}>
          {Renderer ? (
            <Renderer entity={entity} />
          ) : entity.artifact ? (
            <MarkdownArtifactPanel artifact={entity.artifact as any} />
          ) : (
            <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{JSON.stringify(entity.artifact, null, 2)}</pre>
          )}
        </div>
      </div>
      {manifest && (
        <div
          style={{
            borderTop: "var(--app-border)",
            padding: "8px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
          }}
        >
          // {manifest.displayName} · {manifest.kind} · v{manifest.version}
        </div>
      )}
    </div>
  );
}

function filesFromArtifact(entity: Entity): { created: string[]; modified: string[] } | null {
  const a = entity.artifact as { filesCreated?: string[]; filesModified?: string[] } | null;
  if (!a) return null;
  if (!a.filesCreated && !a.filesModified) return null;
  return { created: a.filesCreated ?? [], modified: a.filesModified ?? [] };
}

function ErrorCard({ entity }: { entity: Entity }) {
  return (
    <div className="wb-card" style={{ marginBottom: 12, borderColor: "var(--status-error)" }}>
      <div
        className="wb-card-header wb-section-label"
        style={{
          color: "var(--status-error)",
          background: "color-mix(in srgb, var(--status-error) 10%, transparent)",
          borderBottomColor: "color-mix(in srgb, var(--status-error) 40%, transparent)",
        }}
      >
        error
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div className="wb-sans" style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500, marginBottom: 10 }}>
          {entity.errorMessage ?? "Unknown error"}
        </div>
        {entity.errorStack && (
          <pre
            className="wb-code"
            style={{ color: "#FCA5A5", padding: "10px 12px", fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto" }}
          >
            {entity.errorStack}
          </pre>
        )}
        <div
          className="wb-sans"
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderLeft: "2px solid var(--status-error)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.6,
            background: "var(--bg)",
          }}
        >
          // if this started failing after a rebuild,<br />
          // the claudepanion server may need a restart —<br />
          // stop `claudepanion serve` and run it again.
        </div>
      </div>
    </div>
  );
}

function ContinueCard({ entity }: { entity: Entity }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (entity.status !== "completed") return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await continueEntity(entity.companion, entity.id, text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="wb-card" style={{ marginBottom: 12 }}>
      <div className="wb-card-header wb-section-label">not right? continue</div>
      <div style={{ padding: "12px 14px", display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="// describe what to change…"
          className="wb-input"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={!text.trim() || busy} className="wb-btn">
          {busy ? "…" : "continue"}
        </button>
      </div>
    </form>
  );
}

function RetryCard({ entity }: { entity: Entity }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await continueEntity(entity.companion, entity.id, text.trim() || "retry");
      setText("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="wb-card" style={{ marginBottom: 12 }}>
      <div className="wb-card-header wb-section-label">retry with a hint</div>
      <div style={{ padding: "12px 14px", display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="// e.g. 'add contractVersion: 1 to the manifest'"
          className="wb-input"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={busy} className="wb-btn" style={{ background: "var(--accent)", borderColor: "var(--accent)" }}>
          {busy ? "…" : "retry"}
        </button>
      </div>
    </form>
  );
}

function PendingBanner({ entity }: { entity: Entity }) {
  const mcp = useMcpStatus(true);
  const ageMs = Date.now() - new Date(entity.createdAt).getTime();
  const stuck = !mcp.loading && mcp.firstRequestAt === null && ageMs > MCP_GRACE_MS;
  if (!stuck) return null;
  return (
    <div role="alert" className="wb-card" style={{ marginBottom: 12, borderColor: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 8%, transparent)" }}>
      <div className="wb-card-header wb-section-label" style={{ color: "var(--status-warning)", borderBottomColor: "color-mix(in srgb, var(--status-warning) 40%, transparent)", background: "color-mix(in srgb, var(--status-warning) 10%, transparent)" }}>
        claudepanion hasn't seen any MCP connection
      </div>
      <div style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7 }}>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Run <code>/mcp</code> in your Claude Code session.</li>
          <li><code>claudepanion plugin install</code> in your repo.</li>
          <li>Restart your Claude Code session.</li>
        </ol>
        <div style={{ marginTop: 8, color: "var(--muted)" }}>
          // still stuck? the claudepanion server itself may have died — stop `claudepanion serve` and run it again.
        </div>
      </div>
    </div>
  );
}

function titleOf(e: Entity): string {
  const input = e.input as Record<string, unknown>;
  const raw = (input.title ?? input.name ?? input.target ?? input.description ?? e.companion) as string;
  return raw.length > 60 ? raw.slice(0, 57) + "…" : raw;
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

function durationNow(from: string): string {
  return duration(from, new Date().toISOString());
}
