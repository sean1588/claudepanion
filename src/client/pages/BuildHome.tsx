import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchEntities } from "../api";
import type { Entity } from "@shared/types";

const SUGGESTIONS = [
  { slug: "pr-reviewer", icon: "🔎", title: "GitHub PR reviewer", blurb: "Review a PR — fetch the diff and existing comments, flag risky diffs, suggest review questions." },
  { slug: "cloudwatch", icon: "📊", title: "CloudWatch investigator", blurb: "Tail a log group, summarize errors, surface anomalies in the last hour." },
  { slug: "linear", icon: "📋", title: "Linear backlog groomer", blurb: "Pull the backlog, flag stale issues, suggest priority and assignee." },
];

export default function BuildHome() {
  const [builds, setBuilds] = useState<Entity[] | null>(null);
  useEffect(() => { void fetchEntities("build").then(setBuilds); }, []);

  return (
    <div style={{ maxWidth: 920, display: "flex", flexDirection: "column", gap: 64 }}>
      <div className="t-mono" style={{ color: "var(--muted)" }}>~/ build</div>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="pill pill-eyebrow" style={{ alignSelf: "flex-start" }}>THE BUILD COMPANION · CORE</span>
        <h1 className="t-display-sm" style={{ margin: 0 }}>
          <em className="t-accent-italic">Hi, I'm Build</em> — your first companion.
        </h1>
        <p className="t-body" style={{ color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>
          I scaffold new companions from a plain-English description. Everything else you add to the sidebar came from me.
          Try one of the ideas below, or describe your own.
        </p>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="t-eyebrow">Two ways to start</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Link to="/c/build/new" className="card-hairline" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="t-eyebrow">✨ New companion</span>
            <span className="t-h2" style={{ fontSize: 28 }}>Scaffold from scratch</span>
            <span className="t-caption">Describe a new companion in plain English and Build will create it.</span>
          </Link>
          <Link to="/c/build/new?mode=iterate" className="card-hairline" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="t-eyebrow">⟳ Iterate on existing</span>
            <span className="t-h2" style={{ fontSize: 28 }}>Evolve a companion</span>
            <span className="t-caption">Pick a companion and describe what should change.</span>
          </Link>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="t-eyebrow">Or start from an idea</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {SUGGESTIONS.map((s) => (
            <Link key={s.slug} to={`/c/build/new?example=${s.slug}`} className="card-hairline" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 22 }} aria-hidden>{s.icon}</span>
              <span className="t-h3">{s.title}</span>
              <span className="t-caption">{s.blurb}</span>
              <span className="t-caption" style={{ color: "var(--accent)", marginTop: 4 }}>Try this →</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="t-eyebrow">Recent builds</span>
        {builds === null ? (
          <span className="t-caption">Loading…</span>
        ) : builds.length === 0 ? (
          <div className="t-caption" style={{ textAlign: "center", padding: 32 }}>
            No builds yet. The first one always feels like magic.
          </div>
        ) : (
          <div className="card-hairline" style={{ padding: 0 }}>
            {builds.slice(0, 5).map((b) => (
              <Link key={b.id} to={`/c/build/${b.id}`} style={{ display: "grid", gridTemplateColumns: "120px 1fr 120px", gap: 12, padding: "12px 16px", borderTop: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)", color: "var(--ink)", textDecoration: "none" }}>
                <span className="t-caption" style={{ color: statusColor(b.status) }}>● {b.status}</span>
                <span>{summarize(b)}</span>
                <span className="t-mono" style={{ color: "var(--muted)", fontSize: 11 }}>{b.id.slice(0, 14)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function summarize(e: Entity): string {
  const input = e.input as Record<string, unknown>;
  const raw = (input.name ?? input.target ?? input.description ?? e.id) as string;
  return raw.length > 80 ? raw.slice(0, 77) + "…" : raw;
}

function statusColor(status: string): string {
  if (status === "completed") return "var(--status-success)";
  if (status === "running") return "var(--status-info)";
  if (status === "error") return "var(--status-error)";
  return "var(--status-warning)";
}
