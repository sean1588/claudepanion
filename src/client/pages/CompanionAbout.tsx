import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import Breadcrumb from "../components/Breadcrumb";
import PreflightBanner from "../components/PreflightBanner";
import StatusPill from "../components/StatusPill";
import BuildChips from "../components/BuildChips";
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
  const [entities, setEntities] = useState<Entity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (!manifest || manifest.kind !== "entity") return;
    let cancelled = false;
    void fetchEntities(companion).then((es) => { if (!cancelled) setEntities(es); });
    return () => { cancelled = true; };
  }, [companion, manifest]);

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

  if (error) return <div style={{ color: "#dc2626" }}>Failed to load: {error}</div>;
  if (!manifest || !payload) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const writeTools = payload.tools.filter((t) => t.sideEffect === "write");
  const readTools = payload.tools.filter((t) => t.sideEffect === "read");
  const hasWrites = writeTools.length > 0;
  const visibleEntities = entities.slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Breadcrumb manifest={manifest} />

      {/* Companion header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              background: "var(--soft)",
              border: "1px solid rgba(21, 24, 26, 0.08)",
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              fontSize: 26,
              flexShrink: 0,
            }}
          >
            {manifest.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: "0 0 6px" }}>
              {manifest.displayName}
            </h1>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--muted)", lineHeight: 1.5, maxWidth: 600 }}>
              {manifest.description}
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)", background: "var(--soft)", padding: "3px 8px", borderRadius: 4 }}>
                v{manifest.version}
              </span>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                {manifest.kind} · {entities.length} {entities.length === 1 ? "run" : "runs"}
              </span>
              {hasWrites
                ? <span className="badge badge-write">writes</span>
                : payload.tools.length > 0 && <span className="badge badge-read">read-only</span>}
            </div>
          </div>
        </div>

        {manifest.kind === "entity" && (
          <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate(`/c/build/new?mode=iterate&target=${encodeURIComponent(companion)}`)}
            >
              🔨 Iterate with Build
            </button>
            <button type="button" className="btn" onClick={() => navigate(`/c/${companion}/new`)}>
              {manifest.actionLabels?.newEntity ?? "+ New run"}
            </button>
          </div>
        )}
      </header>

      <PreflightBanner companion={companion} />

      {hasWrites && (
        <div role="alert" className="write-tools-warning">
          <strong>⚠️ This companion writes to external systems.</strong>
          <ul style={{ margin: "8px 0 0 20px", fontSize: 13 }}>
            {writeTools.map((t) => (
              <li key={t.name}>
                <code>{t.name}</code> — {t.description}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            The skill will ask for your permission before each write action.
          </div>
        </div>
      )}

      {/* Runs / empty state — entity-kind only */}
      {manifest.kind === "entity" && (
        entities.length === 0 ? (
          <EmptyRuns
            manifest={manifest}
            onNew={() => navigate(`/c/${companion}/new`)}
            onIterate={() => navigate(`/c/build/new?mode=iterate&target=${encodeURIComponent(companion)}`)}
          />
        ) : (
          <RunsList
            companion={companion}
            entities={visibleEntities}
            total={entities.length}
          />
        )
      )}

      {/* MCP tools (kept — useful informational section) */}
      {payload.tools.length > 0 && (
        <section>
          <h2 className="eyebrow" style={{ margin: "0 0 12px" }}>MCP tools</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...readTools, ...writeTools].map((t) => (
              <div key={t.name} style={{ border: "1px solid rgba(21, 24, 26, 0.08)", borderRadius: 8, padding: 12, background: "var(--paper)" }}>
                <code style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</code>
                {t.sideEffect === "write" && <span className="badge badge-write" style={{ marginLeft: 8 }}>write</span>}
                {t.description && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{t.description}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {manifest.name === "build" && <BuildChips />}

      {/* Danger zone — non-build only */}
      {manifest.name !== "build" && (
        <section style={{ borderTop: "1px solid rgba(21, 24, 26, 0.08)", paddingTop: 16, marginTop: 8 }}>
          <h2 className="eyebrow" style={{ margin: "0 0 8px" }}>Danger zone</h2>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, lineHeight: 1.55 }}>
            Deletes <code>companions/{manifest.name}/</code>, its skill, and saved entities. A rebuild is needed to fully remove it from the client bundle.
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={deleting}
            style={{
              padding: "8px 16px",
              border: "1px solid #C0463D",
              color: "#C0463D",
              background: "transparent",
              borderRadius: 999,
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.5 : 1,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {deleting ? "Removing…" : "Remove companion"}
          </button>
        </section>
      )}
    </div>
  );
}

function EmptyRuns({
  manifest,
  onNew,
  onIterate,
}: {
  manifest: Manifest;
  onNew: () => void;
  onIterate: () => void;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 32px",
        border: "1px dashed rgba(21, 24, 26, 0.15)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 14 }} aria-hidden="true">{manifest.icon}</div>
      <h2 className="serif" style={{ fontSize: 32, margin: "0 0 10px" }}>No runs yet.</h2>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 auto 24px", lineHeight: 1.55, maxWidth: 420 }}>
        Start a new run and fill out the form. Claude Code picks it up when you paste the slash command.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={onNew}>
          {manifest.actionLabels?.newEntity ?? "+ New run"}
        </button>
        <button type="button" className="btn-outline" onClick={onIterate}>
          🔨 Iterate with Build
        </button>
      </div>
    </div>
  );
}

function RunsList({
  companion,
  entities,
  total,
}: {
  companion: string;
  entities: Entity[];
  total: number;
}) {
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h2 className="eyebrow" style={{ margin: 0 }}>
          Past runs · {total} {total === 1 ? "run" : "runs"}
        </h2>
        {total > entities.length && (
          <Link to={`/c/${companion}/runs`} style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>show all →</Link>
        )}
      </div>
      <div style={{ background: "var(--paper)", border: "1px solid rgba(21, 24, 26, 0.08)", borderRadius: 8, overflow: "hidden" }}>
        <div className="mono" style={{
          display: "grid",
          gridTemplateColumns: "110px 1fr 130px 90px",
          padding: "10px 18px",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          borderBottom: "1px solid rgba(21, 24, 26, 0.08)",
          gap: 14,
        }}>
          <span>status</span>
          <span>description</span>
          <span style={{ textAlign: "right" }}>id</span>
          <span style={{ textAlign: "right" }}>updated</span>
        </div>
        {entities.map((e, i) => (
          <Link
            key={e.id}
            to={`/c/${companion}/${e.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 130px 90px",
              padding: "14px 18px",
              alignItems: "center",
              gap: 14,
              borderBottom: i < entities.length - 1 ? "1px dashed rgba(21, 24, 26, 0.08)" : 0,
              textDecoration: "none",
              color: "var(--ink)",
              fontSize: 14,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--bg)")}
            onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
          >
            <StatusPill status={e.status} />
            <span style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: e.status === "error" ? "var(--muted)" : "var(--ink)",
            }}>
              {entityDescription(e)}
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>{e.id}</span>
            <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{timeAgo(e.updatedAt)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function entityDescription(e: Entity): string {
  const input = e.input as Record<string, unknown>;
  const candidates = ["title", "description", "name", "target", "summary"];
  for (const key of candidates) {
    const v = input?.[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return JSON.stringify(input).slice(0, 120);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
