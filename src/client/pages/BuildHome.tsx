import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import { fetchCompanions, fetchEntities } from "../api";
import StatusPill from "../components/StatusPill";
import BuildChips from "../components/BuildChips";
import PreflightBanner from "../components/PreflightBanner";

export default function BuildHome() {
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === "build") ?? null));
    void fetchEntities("build").then(setEntities);
  }, []);

  if (!manifest) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      {/* Top strip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 8 }}>
          <span>~/</span>
          <span style={{ color: "var(--ink)" }}>build</span>
        </div>
        <span className="eyebrow-pill">v{manifest.version} · {typeof window !== "undefined" ? window.location.host : "localhost"}</span>
      </div>

      <PreflightBanner companion="build" />

      {/* Welcome hero */}
      <section
        className="card"
        style={{
          padding: "28px 32px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 32,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <span className="eyebrow-pill eyebrow-pill-accent">The Build companion · core</span>
          </div>
          <h1 className="serif" style={{ fontSize: 52, lineHeight: 1.0, margin: "0 0 14px" }}>
            <span className="serif-italic">Hi, I'm Build</span> — your first
            <br />
            companion.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--muted)", margin: 0, maxWidth: 600 }}>
            I scaffold new companions from a plain-English description. Everything else you add to the sidebar came from me. Try one of the ideas below, or describe your own.
          </p>
        </div>
        <div
          style={{
            width: 160,
            height: 160,
            background: "var(--bg)",
            border: "1px dashed rgba(21, 24, 26, 0.2)",
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            fontSize: 64,
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {manifest.icon}
        </div>
      </section>

      {/* Two-mode cards */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Two ways to start</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <ModeCard
            label="✨ NEW COMPANION"
            title="Scaffold from scratch"
            description="Pick a kind (entity / tool), describe what it should do — Build authors the manifest, types, form, pages, MCP tools, and the skill."
            onClick={() => navigate("/c/build/new")}
          />
          <ModeCard
            label="⟳ ITERATE ON EXISTING"
            title="Evolve a companion"
            description="Pick a target companion, describe the change — Build edits files in place and bumps the version."
            onClick={() => navigate("/c/build/new?mode=iterate")}
          />
        </div>
      </section>

      {/* Chips */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 className="eyebrow" style={{ margin: 0 }}>Ideas to start from · prefills the form</h2>
          <Link to="/c/build/new" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
            or describe your own →
          </Link>
        </div>
        <BuildChips heading={null} />
      </section>

      {/* Past builds */}
      <PastBuilds entities={entities} />
    </div>
  );
}

function ModeCard({
  label,
  title,
  description,
  onClick,
}: {
  label: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-bordered"
      style={{
        background: "var(--paper)",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.08em" }}>{label}</div>
      <div className="serif" style={{ fontSize: 24, lineHeight: 1.15 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{description}</div>
    </button>
  );
}

function PastBuilds({ entities }: { entities: Entity[] }) {
  const visible = entities.slice(0, 8);
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h2 className="eyebrow" style={{ margin: 0 }}>Past builds · {entities.length} entit{entities.length === 1 ? "y" : "ies"}</h2>
        {entities.length > visible.length && (
          <Link to="/c/build/runs" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>show all →</Link>
        )}
      </div>

      {entities.length === 0 ? (
        <div style={{
          padding: "36px 24px",
          textAlign: "center",
          color: "var(--muted)",
          background: "var(--paper)",
          border: "1px solid rgba(21, 24, 26, 0.08)",
          borderRadius: 8,
          fontStyle: "italic",
          fontFamily: "var(--font-serif)",
          fontSize: 18,
        }}>
          No builds yet. The first one always feels like magic.
        </div>
      ) : (
        <div style={{ background: "var(--paper)", border: "1px solid rgba(21, 24, 26, 0.08)", borderRadius: 8, overflow: "hidden" }}>
          <div className="mono" style={{
            display: "grid",
            gridTemplateColumns: "120px 80px 1fr 110px 90px 20px",
            padding: "10px 18px",
            fontSize: 10,
            color: "var(--muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderBottom: "1px solid rgba(21, 24, 26, 0.08)",
            gap: 14,
          }}>
            <span>id</span>
            <span>mode</span>
            <span>target · description</span>
            <span>status</span>
            <span style={{ textAlign: "right" }}>updated</span>
            <span></span>
          </div>
          {visible.map((e, i) => (
            <BuildRow key={e.id} entity={e} isLast={i === visible.length - 1} />
          ))}
        </div>
      )}
    </section>
  );
}

function BuildRow({ entity, isLast }: { entity: Entity; isLast: boolean }) {
  const input = entity.input as { mode?: string; name?: string; target?: string; description?: string };
  const mode = input.mode === "iterate-companion" ? "iterate" : "new";
  const target = input.name ?? input.target ?? "—";
  const description = input.description ?? "";
  return (
    <Link
      to={`/c/build/${entity.id}`}
      className="entity-list-row"
      style={{
        display: "grid",
        gridTemplateColumns: "120px 80px 1fr 110px 90px 20px",
        padding: "14px 18px",
        alignItems: "center",
        gap: 14,
        borderTop: 0,
        borderBottom: isLast ? 0 : "1px dashed rgba(21, 24, 26, 0.08)",
        fontSize: 13,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{entity.id}</span>
      <span style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        alignSelf: "center",
        justifySelf: "start",
        background: mode === "new" ? "rgba(109, 40, 217, 0.12)" : "rgba(30, 64, 175, 0.12)",
        color: mode === "new" ? "#6d28d9" : "#1e40af",
      }}>
        {mode === "new" ? "✨ new" : "⟳ iterate"}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="serif-italic" style={{ fontSize: 17 }}>{target}</div>
        <div style={{
          fontSize: 12,
          color: "var(--muted)",
          marginTop: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {description}
        </div>
      </div>
      <StatusPill status={entity.status} />
      <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>{timeAgo(entity.updatedAt)}</span>
      <span className="serif-italic" style={{ fontSize: 18, color: "var(--muted)", textAlign: "right" }}>›</span>
    </Link>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
