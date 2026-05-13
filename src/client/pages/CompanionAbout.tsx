import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import PreflightBanner from "../components/PreflightBanner";
import { fetchCompanions, fetchEntities, deleteCompanion } from "../api";
import { Sketch } from "../icons/Sketch";

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
      const { rebuildHint } = await deleteCompanion(manifest.name);
      if (rebuildHint) window.alert(`Removed. ${rebuildHint}`);
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

  if (error) return <div style={{ color: "var(--status-error)" }}>Failed to load: {error}</div>;
  if (!manifest || !payload) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const writeTools = payload.tools.filter((t) => t.sideEffect === "write");
  const readTools = payload.tools.filter((t) => t.sideEffect === "read");
  const hasWrites = writeTools.length > 0;
  const runCount = entities?.length ?? 0;

  return (
    <div style={{ maxWidth: 920, display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Breadcrumb */}
      <div className="t-mono" style={{ color: "var(--muted)" }}>
        <Link to="/" style={{ color: "var(--muted)", textDecoration: "none" }}>claudepanion</Link>
        {" › "}
        <span>{manifest.displayName}</span>
      </div>

      {/* Header */}
      <header style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 96, height: 96, background: "var(--soft)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 48 }} aria-hidden>{manifest.icon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 className="t-h2" style={{ margin: 0 }}>{manifest.displayName}</h1>
          <p className="t-body" style={{ color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>{manifest.description}</p>
          <div className="t-mono" style={{ color: "var(--muted)", fontSize: 11, display: "flex", gap: 16 }}>
            <span>v{manifest.version}</span>
            <span>·</span>
            <span>{manifest.kind}</span>
            <span>·</span>
            <span>{runCount} run{runCount === 1 ? "" : "s"}</span>
            {hasWrites ? <><span>·</span><span style={{ color: "var(--status-warning)" }}>writes</span></> : payload.tools.length > 0 ? <><span>·</span><span>read-only</span></> : null}
          </div>
        </div>
      </header>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 8 }}>
        <Link to={`/c/build/new?mode=iterate&target=${manifest.name}`} className="btn-ghost">🔨 Iterate with Build</Link>
        {manifest.kind === "ui" && (
          <Link to={`/c/${manifest.name}/new`} className="btn-ink">
            + {manifest.actionLabels?.newEntity ?? "New run"}
          </Link>
        )}
      </div>

      <PreflightBanner companion={companion} />

      {/* Write-tools warning */}
      {hasWrites && (
        <div role="alert" className="card-hairline" style={{ borderColor: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 6%, transparent)" }}>
          <strong>⚠️ This companion writes to external systems.</strong>
          <ul style={{ margin: "8px 0 0 20px" }}>
            {writeTools.map((t) => (
              <li key={t.name} className="t-caption" style={{ color: "var(--ink)" }}>
                <code>{t.name}</code> — {t.description}
              </li>
            ))}
          </ul>
          <div className="t-caption" style={{ marginTop: 8 }}>
            The skill will ask for your permission before each write action.
          </div>
        </div>
      )}

      {/* Runs table or empty state */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="t-eyebrow">Recent runs</span>
        {entities === null ? (
          <span className="t-caption">Loading…</span>
        ) : entities.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, gap: 12 }}>
            <span style={{ color: "color-mix(in srgb, var(--ink) 15%, transparent)" }}>
              <Sketch.Plant size={120} />
            </span>
            <span className="t-caption">Past runs will live here.</span>
          </div>
        ) : (
          <div className="card-hairline" style={{ padding: 0 }}>
            {entities.slice(0, 10).map((e) => (
              <Link key={e.id} to={`/c/${manifest.name}/${e.id}`} style={{ display: "grid", gridTemplateColumns: "120px 1fr 140px", gap: 12, padding: "12px 16px", borderTop: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)", color: "var(--ink)", textDecoration: "none", alignItems: "center" }}>
                <span className="t-caption" style={{ color: statusColor(e.status) }}>● {e.status}</span>
                <span>{summarize(e)}</span>
                <span className="t-mono" style={{ color: "var(--muted)", fontSize: 11 }}>{timeAgo(e.createdAt)}</span>
              </Link>
            ))}
            {entities.length > 10 && (
              <div style={{ padding: "10px 16px", borderTop: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)" }}>
                <Link to={`/c/${manifest.name}/runs`} className="t-caption" style={{ color: "var(--accent)" }}>
                  Showing 10 of {entities.length} · show all →
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* MCP tools list */}
      {payload.tools.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="t-eyebrow">MCP tools</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...readTools, ...writeTools].map((t) => (
              <div key={t.name} className="card-hairline" style={{ padding: 12 }}>
                <code style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</code>
                {t.sideEffect === "write" && <span className="pill" style={{ marginLeft: 8, background: "color-mix(in srgb, var(--status-warning) 20%, transparent)", color: "var(--status-warning)" }}>write</span>}
                {t.description && <div className="t-caption" style={{ marginTop: 4 }}>{t.description}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Danger zone (not for Build, which is handled by BuildHome) */}
      {manifest.name !== "build" && (
        <section style={{ borderTop: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)", paddingTop: 24, marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="t-eyebrow">Danger zone</span>
          <p className="t-caption" style={{ margin: 0 }}>
            Deletes <code>companions/{manifest.name}/</code>, its skill, and saved entities. A rebuild is needed to fully remove it from the client bundle.
          </p>
          <button
            type="button"
            onClick={onRemove}
            disabled={deleting}
            className="btn-ghost"
            style={{ alignSelf: "flex-start", borderColor: "var(--status-error)", color: "var(--status-error)", opacity: deleting ? 0.5 : 1, cursor: deleting ? "not-allowed" : "pointer" }}
          >
            {deleting ? "Removing…" : "Remove companion"}
          </button>
        </section>
      )}
    </div>
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
  if (status === "completed") return "var(--status-success)";
  if (status === "running") return "var(--status-info)";
  if (status === "error") return "var(--status-error)";
  return "var(--status-warning)";
}
