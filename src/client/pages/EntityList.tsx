import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import { fetchCompanions, fetchEntities } from "../api";
import { getListRow } from "../../../companions/client";

export default function EntityList() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
    void fetchEntities(companion).then(setEntities);
  }, [companion]);

  if (!manifest) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;

  const Row = getListRow(companion);

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="wb-section-label" style={{ marginBottom: 6 }}>all runs</div>
          <h1 className="wb-serif" style={{ fontSize: 38, lineHeight: 1.0, margin: 0 }}>{manifest.displayName}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {companion === "build" ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/c/build/evolve`)}
                className="wb-btn wb-btn-ghost wb-btn-sm"
              >
                ⟳ iterate on existing
              </button>
              <button
                type="button"
                onClick={() => navigate(`/c/build/new`)}
                className="wb-btn wb-btn-sm"
              >
                $ new companion
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate(`/c/build/iterate/${companion}`)}
                className="wb-btn wb-btn-ghost wb-btn-sm"
              >
                🔨 iterate with build
              </button>
              {manifest.kind === "ui" && (
                <button
                  type="button"
                  onClick={() => navigate(`/c/${companion}/new`)}
                  className="wb-btn wb-btn-sm"
                >
                  $ new run
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {entities.length === 0 ? (
        <div
          style={{
            border: "1px dashed color-mix(in srgb, var(--ink) 30%, transparent)",
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden>{manifest.icon}</div>
          <div className="wb-serif" style={{ fontSize: 28, marginBottom: 8 }}>No runs yet.</div>
          <p className="wb-sans" style={{ fontSize: 13, color: "var(--muted)", margin: "0 auto 0", lineHeight: 1.55, maxWidth: 420 }}>
            Click <strong>$ new run</strong> to get started.
          </p>
        </div>
      ) : (
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
          {entities.map((e, i) => {
            const last = i === entities.length - 1;
            return (
              <Link
                key={e.id}
                to={`/c/${companion}/${e.id}`}
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
                {Row ? (
                  <Row entity={e} />
                ) : (
                  <span
                    className="wb-sans"
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {summarize(e)}
                  </span>
                )}
                <span style={{ color: "var(--muted)", fontSize: 11 }}>{e.id.slice(0, 14)}</span>
                <span className="wb-sans" style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
                  {timeAgo(e.updatedAt)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
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
  const a = e.artifact as { summary?: string } | null;
  if (a?.summary) return a.summary;
  const input = e.input as { description?: string };
  return input.description ?? JSON.stringify(e.input).slice(0, 80);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function statusColor(status: Entity["status"]): string {
  if (status === "completed") return "var(--sage)";
  if (status === "running") return "var(--accent)";
  if (status === "error") return "var(--status-error)";
  return "var(--status-warning)";
}
