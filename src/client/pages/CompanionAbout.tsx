import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Manifest } from "@shared/types";
import Breadcrumb from "../components/Breadcrumb";
import PreflightBanner from "../components/PreflightBanner";
import BuildChips from "../components/BuildChips";
import { fetchCompanions, deleteCompanion } from "../api";

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
          // Entity-kind doesn't have /api/tools; build payload from manifest only.
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

  if (error) return <div style={{ color: "#dc2626" }}>Failed to load: {error}</div>;
  if (!manifest || !payload) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const writeTools = payload.tools.filter((t) => t.sideEffect === "write");
  const readTools = payload.tools.filter((t) => t.sideEffect === "read");
  const hasWrites = writeTools.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Breadcrumb manifest={manifest} />
      <header style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span style={{ fontSize: 40 }} aria-hidden="true">{manifest.icon}</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0 }}>{manifest.displayName}</h1>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            claudepanion-{manifest.name} · v{manifest.version}
            {hasWrites
              ? <span className="badge badge-write" style={{ marginLeft: 8 }}>writes</span>
              : payload.tools.length > 0 && <span className="badge badge-read" style={{ marginLeft: 8 }}>read-only</span>}
          </div>
          <p style={{ marginTop: 8, marginBottom: 0 }}>{manifest.description}</p>
        </div>
        {manifest.kind === "entity" && (
          <Link to={`/c/${manifest.name}/new`} className="btn" style={{ whiteSpace: "nowrap" }}>
            {manifest.actionLabels?.newEntity ?? "Start a new run"}
          </Link>
        )}
        <Link to={`/c/${manifest.name}/runs`} className="btn-outline" style={{ whiteSpace: "nowrap" }}>
          {manifest.actionLabels?.listEntities ?? "View runs"}
        </Link>
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

      {payload.tools.length > 0 && (
        <section>
          <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>MCP tools</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...readTools, ...writeTools].map((t) => (
              <div key={t.name} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
                <code style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</code>
                {t.sideEffect === "write" && <span className="badge badge-write" style={{ marginLeft: 8 }}>write</span>}
                {t.description && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{t.description}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {manifest.name === "build" && <BuildChips />}

      {manifest.name !== "build" && (
        <section style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16, marginTop: 8 }}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>Danger zone</h2>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            Deletes <code>companions/{manifest.name}/</code>, its skill, and saved entities. A rebuild is needed to fully remove it from the client bundle.
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={deleting}
            style={{
              padding: "8px 14px",
              border: "1px solid #dc2626",
              color: "#dc2626",
              background: "white",
              borderRadius: 6,
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.5 : 1,
            }}
          >
            {deleting ? "Removing…" : "Remove companion"}
          </button>
        </section>
      )}
    </div>
  );
}
