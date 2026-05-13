import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import { useCompanions } from "../hooks/useCompanions";
import { fetchEntities } from "../api";
import { Sketch } from "../icons/Sketch";

export default function BuildEvolve() {
  const { companions, loading } = useCompanions();
  const targets = companions.filter((c) => c.kind === "ui" && c.name !== "build");
  const [runCounts, setRunCounts] = useState<Record<string, { count: number; lastRun: string | null }>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        targets.map(async (c) => {
          try {
            const rows = await fetchEntities(c.name);
            const lastRun = rows.length === 0 ? null : rows.reduce<string>((acc, r) => (r.createdAt > acc ? r.createdAt : acc), rows[0].createdAt);
            return [c.name, { count: rows.length, lastRun }] as const;
          } catch {
            return [c.name, { count: 0, lastRun: null }] as const;
          }
        })
      );
      if (!cancelled) setRunCounts(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [targets.map((c) => c.name).join(",")]);

  return (
    <div style={{ maxWidth: 920, display: "flex", flexDirection: "column", gap: 32 }}>
      <div className="t-mono" style={{ color: "var(--muted)" }}>
        <Link to="/" style={{ color: "var(--muted)", textDecoration: "none" }}>claudepanion</Link>
        {" › "}
        <Link to="/c/build" style={{ color: "var(--muted)", textDecoration: "none" }}>Build</Link>
        {" › "}
        <span>Evolve</span>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="pill pill-eyebrow" style={{ alignSelf: "flex-start" }}>⟳ ITERATE ON EXISTING</span>
        <h1 className="t-display-sm" style={{ margin: 0 }}>
          Which <em className="t-accent-italic">companion</em>?
        </h1>
        <p className="t-body" style={{ color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>
          Pick a companion to evolve. Build will load its current shape so you can describe what should change.
        </p>
      </section>

      {loading ? (
        <span className="t-caption">Loading…</span>
      ) : targets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card-hairline" style={{ padding: 0 }}>
          {targets.map((c, i) => {
            const stats = runCounts[c.name] ?? { count: 0, lastRun: null };
            return (
              <Link
                key={c.name}
                to={`/c/build/new?mode=iterate&target=${c.name}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px minmax(0, 1fr) 120px 140px",
                  gap: 16,
                  padding: "14px 16px",
                  borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--ink) 8%, transparent)",
                  color: "var(--ink)",
                  textDecoration: "none",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 28 }} aria-hidden>{c.icon}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className="t-h3">{c.displayName}</span>
                  <span className="t-caption" style={{ margin: 0 }}>{c.description}</span>
                </div>
                <span className="t-mono" style={{ color: "var(--muted)", fontSize: 11 }}>
                  v{c.version}
                </span>
                <span className="t-caption" style={{ color: "var(--muted)" }}>
                  {stats.count} run{stats.count === 1 ? "" : "s"}{stats.lastRun ? ` · ${timeAgo(stats.lastRun)}` : ""}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, gap: 16 }}>
      <span style={{ color: "color-mix(in srgb, var(--ink) 15%, transparent)" }}>
        <Sketch.Plant size={120} />
      </span>
      <span className="t-caption">Nothing to evolve yet — scaffold a companion first.</span>
      <Link to="/c/build/new" className="btn-ink">+ Scaffold from scratch</Link>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
