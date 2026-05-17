import { useState } from "react";
import { Link } from "react-router-dom";
import type { Manifest } from "@shared/types";

const COMMUNITY_PACKAGES = [
  { name: "claudepanion-pr-reviewer", author: "claudepanion-community", version: "1.2.3", downloads: "1.2k" },
  { name: "claudepanion-oncall", author: "claudepanion-community", version: "0.8.0", downloads: "640" },
  { name: "claudepanion-linear-grooming", author: "claudepanion-community", version: "0.4.1", downloads: "230" },
  { name: "claudepanion-rss-summarizer", author: "claudepanion-community", version: "0.2.0", downloads: "89" },
];

export default function Install() {
  const [pkg, setPkg] = useState("");
  const [state, setState] = useState<"idle" | "installing" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Manifest | null>(null);

  const valid = /^claudepanion-[a-z0-9-]+$/.test(pkg);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setState("installing");
    setError(null);
    try {
      const r = await fetch("/api/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageName: pkg }),
      });
      const data = await r.json();
      if (data.ok) {
        setInstalled(data.companion);
        setState("success");
      } else {
        setError(data.error || "unknown error");
        setState("error");
      }
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  };

  return (
    <div style={{ maxWidth: 1100, display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Breadcrumb */}
      <div className="t-mono" style={{ color: "var(--muted)" }}>
        <Link to="/" style={{ color: "var(--muted)", textDecoration: "none" }}>claudepanion</Link>
        {" › "}
        <span>Install</span>
      </div>

      {/* Eyebrow + hero */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="pill pill-eyebrow" style={{ alignSelf: "flex-start" }}>INSTALL FROM NPM</span>
        <h1 className="t-display-sm" style={{ margin: 0 }}>What would you like to <em className="t-accent-italic">install</em>?</h1>
        <p className="t-body" style={{ color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>
          claudepanion uses npm as its package registry. Anything published as <code>claudepanion-&lt;name&gt;</code> works.
        </p>
      </div>

      {/* Two-column: input + state on left, community-packages aside on right */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 32, alignItems: "start" }}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="t-mono" style={{ color: "var(--muted)", fontSize: 12 }}>$ npx claudepanion install</div>
          <input
            className="editorial-input t-mono"
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
            placeholder="claudepanion-pr-reviewer"
            disabled={state === "installing"}
            style={{ fontFamily: "var(--font-mono)" }}
          />
          {!valid && pkg.length > 0 && (
            <span className="t-caption" style={{ color: "var(--status-warning)" }}>
              Must start with <code>claudepanion-</code> and use lowercase / digits / hyphens.
            </span>
          )}
          <div>
            <button type="submit" className="btn-ink" disabled={!valid || state === "installing"}>
              {state === "installing" ? "Installing…" : "Install"}
            </button>
          </div>

          {state === "installing" && (
            <div className="panel-mono">
              <span className="t-eyebrow" style={{ color: "var(--bg)" }}>Running</span>
              <pre style={{ margin: "6px 0 0", fontSize: 12, color: "var(--bg)", whiteSpace: "pre-wrap" }}>
                $ npx claudepanion install {pkg}
              </pre>
            </div>
          )}

          {state === "success" && installed && (
            <div className="card-hairline" style={{ borderColor: "var(--status-success)", background: "color-mix(in srgb, var(--status-success) 6%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: "var(--status-success)" }}>✓</span>
                <span><strong>Installed {installed.icon} {installed.displayName}</strong> v{installed.version}</span>
              </div>
              <Link to={`/c/${installed.name}`} className="btn-ink">Open companion →</Link>
            </div>
          )}

          {state === "error" && error && (
            <div role="alert" className="card-hairline" style={{ borderColor: "var(--status-error)", background: "color-mix(in srgb, var(--status-error) 6%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: "var(--status-error)" }}>×</span>
                <span><strong>Install failed</strong></span>
              </div>
              <pre className="t-mono" style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{error}</pre>
            </div>
          )}

          <p className="t-caption" style={{ marginTop: 8 }}>
            Browse all on <a href="https://npmjs.com/search?q=claudepanion-" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>npmjs.com →</a>
          </p>
        </form>

        {/* Community packages aside */}
        <aside className="card-soft" style={{ position: "sticky", top: 24 }}>
          <div className="t-h3" style={{ marginBottom: 12 }}>Community packages</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {COMMUNITY_PACKAGES.map((p) => (
              <div key={p.name} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", background: "var(--bg)", borderRadius: 6, border: "1px solid color-mix(in srgb, var(--ink) 6%, transparent)" }}>
                <code className="t-mono" style={{ fontSize: 13, color: "var(--ink)" }}>{p.name}</code>
                <span className="t-caption" style={{ fontSize: 11 }}>{p.author} · v{p.version} · {p.downloads} downloads</span>
                <button
                  type="button"
                  className="btn-chip"
                  onClick={() => setPkg(p.name)}
                  disabled={state === "installing"}
                  style={{ alignSelf: "flex-start", marginTop: 4 }}
                >
                  Install
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
