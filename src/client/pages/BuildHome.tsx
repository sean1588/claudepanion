import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchEntities } from "../api";
import type { Entity } from "@shared/types";
import { buildExamples } from "../../../companions/build/examples";

export default function BuildHome() {
  const [builds, setBuilds] = useState<Entity[] | null>(null);
  useEffect(() => { void fetchEntities("build").then(setBuilds); }, []);

  const running = builds ? builds.filter((b) => b.status === "running").length : 0;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Hero strip */}
      <section style={{ padding: "28px 24px 24px", borderBottom: "var(--app-border)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
          core companion · v0.2.0 · localhost:3001
        </div>
        <h1 className="wb-serif" style={{ fontSize: 48, lineHeight: 1.05, margin: "0 0 12px" }}>
          <em>Hi, I'm Build</em> — your first companion.
        </h1>
        <p className="wb-sans" style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55, margin: 0, maxWidth: 720 }}>
          I scaffold new companions from a plain-English description. Everything else you add to the sidebar came from me.
          Pick an idea below or describe your own — once you submit, I hand you a slash command to paste into Claude Code.
        </p>
      </section>

      {/* Two ways to start */}
      <section style={{ padding: "20px 24px 24px", borderBottom: "var(--app-border)" }}>
        <div style={{ marginBottom: 10 }}>
          <span className="wb-section-label">two ways to start</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Link to="/c/build/new" className="wb-chip" style={{ padding: 14, textDecoration: "none", color: "var(--ink)", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>✨ new</span>
            <span className="wb-sans" style={{ fontSize: 14, fontWeight: 600 }}>Scaffold from scratch</span>
            <span className="wb-sans" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>Describe a new companion in plain English; Build creates the manifest, MCP tools, skill, and pages.</span>
          </Link>
          <Link to="/c/build/evolve" className="wb-chip" style={{ padding: 14, textDecoration: "none", color: "var(--ink)", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>⟳ iterate</span>
            <span className="wb-sans" style={{ fontSize: 14, fontWeight: 600 }}>Evolve a companion</span>
            <span className="wb-sans" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>Pick a companion and describe what should change.</span>
          </Link>
        </div>
      </section>

      {/* Ideas to start from */}
      <section style={{ padding: "20px 24px 24px", borderBottom: "var(--app-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span className="wb-section-label">ideas to start from</span>
          <Link to="/c/build/new" className="wb-sans" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
            or write your own description →
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {buildExamples.map((ex) => (
            <Link
              key={ex.slug}
              to={`/c/build/new?example=${ex.slug}`}
              className="wb-chip"
              style={{
                padding: 14,
                textDecoration: "none",
                color: "var(--ink)",
                display: "grid",
                gridTemplateColumns: "32px 1fr",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>{ex.icon}</div>
              <div>
                <div className="wb-sans" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{ex.displayName}</div>
                <div className="wb-sans" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45, marginBottom: 6 }}>
                  {ex.description.split(".")[0] + "."}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
                  → {ex.slug}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Past builds */}
      <section style={{ padding: "20px 24px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span className="wb-section-label">past builds</span>
          {builds && builds.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              {builds.length} {builds.length === 1 ? "entity" : "entities"}{running > 0 ? ` · ${running} running` : ""}
            </span>
          )}
        </div>

        {builds === null ? (
          <span className="wb-sans" style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</span>
        ) : builds.length === 0 ? (
          <div className="wb-card" style={{ padding: 32, textAlign: "center" }}>
            <div className="wb-serif" style={{ fontSize: 24, marginBottom: 8 }}>No builds yet.</div>
            <div className="wb-sans" style={{ fontSize: 13, color: "var(--muted)" }}>
              The first one always feels like magic.
            </div>
          </div>
        ) : (
          <div className="wb-card">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 60px 1fr 110px 90px",
                padding: "8px 14px",
                borderBottom: "var(--app-border)",
                background: "var(--ink)",
                color: "var(--bg)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                gap: 10,
              }}
            >
              <span>id</span>
              <span>mode</span>
              <span>target · description</span>
              <span>status</span>
              <span style={{ textAlign: "right" }}>when</span>
            </div>
            {builds.slice(0, 12).map((b, i) => {
              const last = i === Math.min(builds.length, 12) - 1;
              const mode = (b.input as { mode?: string } | undefined)?.mode === "iterate-companion" ? "iter" : "new";
              return (
                <Link
                  key={b.id}
                  to={`/c/build/${b.id}`}
                  className="wb-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 60px 1fr 110px 90px",
                    padding: "12px 14px",
                    gap: 10,
                    alignItems: "center",
                    color: "var(--ink)",
                    textDecoration: "none",
                    borderBottom: last ? 0 : "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>{b.id.slice(0, 14)}</span>
                  <span style={{ fontSize: 10, color: mode === "new" ? "#6d28d9" : "#1e40af" }}>{mode}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="wb-sans" style={{ fontSize: 13, fontWeight: 500 }}>{targetLabel(b)}</div>
                    <div
                      className="wb-sans"
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {summarize(b)}
                    </div>
                  </div>
                  <StatusPill status={b.status} />
                  <span style={{ fontSize: 10, color: "var(--muted)", textAlign: "right" }}>{when(b)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
      {status}
    </span>
  );
}

function targetLabel(e: Entity): string {
  const input = e.input as { name?: string; target?: string };
  return input.name ?? input.target ?? e.id;
}

function summarize(e: Entity): string {
  const input = e.input as { description?: string };
  const raw = input.description ?? "";
  return raw.length > 120 ? raw.slice(0, 117) + "…" : raw;
}

function when(e: Entity): string {
  const ts = e.updatedAt || e.createdAt;
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function statusColor(status: string): string {
  if (status === "completed") return "var(--status-success)";
  if (status === "running") return "var(--status-info)";
  if (status === "error") return "var(--status-error)";
  return "var(--status-warning)";
}
