import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import { fetchEntities } from "../api";

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
    <div style={{ padding: "22px 28px 60px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="wb-section-label" style={{ marginBottom: 8 }}>iterate on existing</div>
        <h1 className="wb-serif" style={{ fontSize: 44, lineHeight: 1.05, margin: "0 0 10px" }}>
          Which <em>companion</em>?
        </h1>
        <p className="wb-sans" style={{ color: "var(--muted)", margin: 0, fontSize: 13, lineHeight: 1.55, maxWidth: 640 }}>
          Pick a companion to evolve. Build will load its current shape so you can describe what should change.
        </p>
      </div>

      {loading ? (
        <span className="wb-sans" style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</span>
      ) : targets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="wb-card">
          {targets.map((c, i) => {
            const stats = runCounts[c.name] ?? { count: 0, lastRun: null };
            const last = i === targets.length - 1;
            return (
              <Link
                key={c.name}
                to={`/c/build/iterate/${c.name}`}
                className="wb-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px minmax(0, 1fr) 120px 140px",
                  gap: 16,
                  padding: "14px 16px",
                  color: "var(--ink)",
                  textDecoration: "none",
                  alignItems: "center",
                  borderBottom: last ? 0 : "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)",
                }}
              >
                <span style={{ fontSize: 28 }} aria-hidden>{c.icon}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span className="wb-sans" style={{ fontSize: 14, fontWeight: 600 }}>{c.displayName}</span>
                  <span className="wb-sans" style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 11 }}>v{c.version}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 11 }}>
                  {stats.count} {stats.count === 1 ? "run" : "runs"}{stats.lastRun ? ` · ${timeAgo(stats.lastRun)}` : ""}
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
    <div
      style={{
        border: "1px dashed color-mix(in srgb, var(--ink) 30%, transparent)",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div className="wb-serif" style={{ fontSize: 28, marginBottom: 8 }}>Nothing to evolve yet.</div>
      <p className="wb-sans" style={{ fontSize: 13, color: "var(--muted)", margin: "0 auto 16px", maxWidth: 400, lineHeight: 1.55 }}>
        Scaffold a companion first, then come back to iterate on it.
      </p>
      <Link to="/c/build/new" className="wb-btn wb-btn-sm" style={{ textDecoration: "none" }}>
        $ scaffold from scratch
      </Link>
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
