import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import PreflightBanner from "../components/PreflightBanner";
import { fetchCompanions, fetchEntities, deleteCompanion } from "../api";

interface ToolDescriptor {
  name: string;
  description: string;
  params: Array<{ name: string; required?: boolean; description?: string }>;
  signature: string;
  sideEffect: "read" | "write";
}

interface AboutPayload {
  manifest: Manifest;
  tools: ToolDescriptor[];
}

export default function CompanionAbout() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [payload, setPayload] = useState<AboutPayload | null>(null);
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onRemove = async () => {
    if (!manifest) return;
    const ok = window.confirm(
      `Remove "${manifest.displayName}"? This deletes companions/${manifest.name}/, its skill, and any saved entities. This cannot be undone.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteCompanion(manifest.name);
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await fetchCompanions();
        if (!cancelled) setManifest(all.find((m) => m.name === companion) ?? null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [companion]);

  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/tools/${encodeURIComponent(companion)}`);
        if (r.status === 400 || r.status === 404) {
          if (!cancelled) setPayload({ manifest, tools: [] });
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if (!cancelled) setPayload(await r.json());
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [companion, manifest]);

  useEffect(() => {
    let cancelled = false;
    void fetchEntities(companion).then((rows) => { if (!cancelled) setEntities(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [companion]);

  if (error) return <div style={{ padding: 24, color: "var(--status-error)" }}>Failed to load: {error}</div>;
  if (!manifest || !payload) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;

  const writeTools = payload.tools.filter((t) => t.sideEffect === "write");
  const readTools = payload.tools.filter((t) => t.sideEffect === "read");
  const hasWrites = writeTools.length > 0;
  const runCount = entities?.length ?? 0;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 24,
          paddingBottom: 20,
          borderBottom: "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: "var(--soft)",
            border: "var(--app-border)",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {manifest.icon}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="wb-serif" style={{ fontSize: 38, lineHeight: 1.0, margin: "0 0 6px" }}>
            {manifest.displayName}
          </h1>
          <p className="wb-sans" style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)", lineHeight: 1.55, maxWidth: 640 }}>
            {manifest.description}
          </p>
          <div style={{ display: "flex", gap: 14, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
            <span>v{manifest.version}</span>
            <span>·</span>
            <span>{manifest.kind}</span>
            <span>·</span>
            <span>{runCount} {runCount === 1 ? "run" : "runs"}</span>
            {hasWrites ? <><span>·</span><span style={{ color: "var(--status-warning)" }}>writes</span></> : payload.tools.length > 0 ? <><span>·</span><span>read-only</span></> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Link to={`/c/build/iterate/${manifest.name}`} className="wb-btn wb-btn-ghost wb-btn-sm" style={{ textDecoration: "none" }}>
            🔨 iterate with build
          </Link>
          {manifest.kind === "ui" && (
            <Link to={`/c/${manifest.name}/new`} className="wb-btn wb-btn-sm" style={{ textDecoration: "none" }}>
              $ {manifest.actionLabels?.newEntity ?? "new run"}
            </Link>
          )}
        </div>
      </div>

      <PreflightBanner companion={companion} />

      {hasWrites && (
        <div role="alert" className="wb-card" style={{ marginBottom: 16, borderColor: "var(--status-warning)" }}>
          <div className="wb-card-header wb-section-label" style={{ color: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 10%, transparent)", borderBottomColor: "color-mix(in srgb, var(--status-warning) 40%, transparent)" }}>
            // this companion writes to external systems
          </div>
          <div style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {writeTools.map((t) => (
                <li key={t.name}>
                  <code>{t.name}</code> — <span style={{ color: "var(--muted)" }}>{t.description}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 8, color: "var(--muted)" }}>
              // the skill asks for your permission before each write.
            </div>
          </div>
        </div>
      )}

      {/* Runs table / empty state */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 10 }}>
          <span className="wb-section-label">recent runs</span>
        </div>
        {entities === null ? (
          <span className="wb-sans" style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</span>
        ) : entities.length === 0 ? (
          <EmptyRuns manifest={manifest} />
        ) : (
          <RunsTable manifest={manifest} entities={entities} />
        )}
        {entities && entities.length > 10 && (
          <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
            {entities.length} runs ·{" "}
            <Link to={`/c/${manifest.name}/runs`} style={{ color: "var(--accent)", textDecoration: "none" }}>
              show all →
            </Link>
          </div>
        )}
      </section>

      {/* MCP tools list */}
      {payload.tools.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 10 }}>
            <span className="wb-section-label">mcp tools</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...readTools, ...writeTools].map((t) => (
              <div key={t.name} className="wb-card" style={{ padding: "10px 14px" }}>
                <code style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{t.name}</code>
                {t.sideEffect === "write" && (
                  <span className="wb-tag" style={{ marginLeft: 8, color: "var(--status-warning)", borderColor: "var(--status-warning)" }}>
                    write
                  </span>
                )}
                {t.description && (
                  <div className="wb-sans" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    {t.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Danger zone */}
      {manifest.name !== "build" && (
        <section
          style={{
            borderTop: "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)",
            paddingTop: 20,
            marginTop: 24,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <span className="wb-section-label">danger zone</span>
          </div>
          <p className="wb-sans" style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted)", maxWidth: 600 }}>
            Deletes <code>companions/{manifest.name}/</code>, its skill, its compiled output, and saved entities. Takes effect immediately — no rebuild or restart needed.
          </p>
          <button
            type="button"
            onClick={onRemove}
            disabled={deleting}
            className="wb-btn wb-btn-ghost wb-btn-sm"
            style={{ borderColor: "var(--status-error)", color: "var(--status-error)" }}
          >
            {deleting ? "removing…" : "remove companion"}
          </button>
        </section>
      )}
    </div>
  );
}

function EmptyRuns({ manifest }: { manifest: Manifest }) {
  return (
    <div
      style={{
        border: "1px dashed color-mix(in srgb, var(--ink) 30%, transparent)",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden>{manifest.icon}</div>
      <div className="wb-serif" style={{ fontSize: 28, marginBottom: 8 }}>No runs yet.</div>
      <p
        className="wb-sans"
        style={{ fontSize: 13, color: "var(--muted)", margin: "0 auto 20px", lineHeight: 1.55, maxWidth: 400 }}
      >
        Start a new run and fill out the form. Claude picks it up when you paste the slash command.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {manifest.kind === "ui" && (
          <Link to={`/c/${manifest.name}/new`} className="wb-btn wb-btn-sm" style={{ textDecoration: "none" }}>
            $ {manifest.actionLabels?.newEntity ?? "new run"}
          </Link>
        )}
        <Link to={`/c/build/iterate/${manifest.name}`} className="wb-btn wb-btn-ghost wb-btn-sm" style={{ textDecoration: "none" }}>
          🔨 iterate with build
        </Link>
      </div>
    </div>
  );
}

function RunsTable({ manifest, entities }: { manifest: Manifest; entities: Entity[] }) {
  const rows = entities.slice(0, 10);
  return (
    <div className="wb-card">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr 110px 80px",
          padding: "8px 14px",
          background: "var(--ink)",
          color: "var(--bg)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        <span>status</span>
        <span>description</span>
        <span>id</span>
        <span style={{ textAlign: "right" }}>updated</span>
      </div>
      {rows.map((e, i) => {
        const last = i === rows.length - 1;
        return (
          <Link
            key={e.id}
            to={`/c/${manifest.name}/${e.id}`}
            className="wb-row"
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 110px 80px",
              padding: "12px 14px",
              gap: 12,
              alignItems: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--ink)",
              textDecoration: "none",
              borderBottom: last ? 0 : "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)",
            }}
          >
            <StatusPillMini status={e.status} />
            <span
              className="wb-sans"
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: e.status === "error" ? "var(--muted)" : "var(--ink)" }}
            >
              {summarize(e)}
            </span>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>{e.id.slice(0, 14)}</span>
            <span className="wb-sans" style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
              {timeAgo(e.createdAt)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function StatusPillMini({ status }: { status: Entity["status"] }) {
  const color = statusColor(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
      {status}
    </span>
  );
}

function summarize(e: Entity): string {
  const input = e.input as Record<string, unknown>;
  const raw = (input.title ?? input.name ?? input.target ?? input.description ?? e.id) as string;
  return raw.length > 80 ? raw.slice(0, 77) + "…" : raw;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function statusColor(status: Entity["status"]): string {
  if (status === "completed") return "var(--sage)";
  if (status === "running") return "var(--accent)";
  if (status === "error") return "var(--status-error)";
  return "var(--status-warning)";
}
