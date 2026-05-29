import { useState } from "react";
import { Link } from "react-router-dom";
import type { Manifest } from "@shared/types";

const COMMUNITY_PACKAGES = [
  { name: "claudepanion-pr-reviewer", icon: "🔎", desc: "Review GitHub pull requests, flag risky diffs." },
  { name: "claudepanion-oncall", icon: "🚨", desc: "Investigate alarms across AWS / GitHub / Linear." },
  { name: "claudepanion-linear-grooming", icon: "📋", desc: "Triage Linear backlogs, suggest priority changes." },
  { name: "claudepanion-rss-summarizer", icon: "📰", desc: "Summarize new RSS posts, surface what to read." },
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
    <div style={{ padding: "22px 28px 60px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--accent)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          $ claudepanion install &lt;package&gt;
        </div>
        <h1 className="wb-serif" style={{ fontSize: 44, lineHeight: 1.0, margin: "0 0 10px" }}>
          Install from <em>npm</em>.
        </h1>
        <p className="wb-sans" style={{ fontSize: 13, color: "var(--muted)", margin: 0, maxWidth: 600, lineHeight: 1.55 }}>
          Any <code style={{ background: "var(--soft)", padding: "1px 6px", fontSize: 12, fontFamily: "var(--font-mono)" }}>claudepanion-*</code> npm package. The host installs, validates the companion contract, and hot-mounts it — no restart.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 28, alignItems: "start" }}>
        {/* Form column */}
        <div>
          <form onSubmit={submit} className="wb-card" style={{ marginBottom: 12 }}>
            <div className="wb-card-header wb-section-label">package name</div>
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  className="wb-input"
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value)}
                  placeholder="claudepanion-pr-reviewer"
                  disabled={state === "installing"}
                  style={{
                    flex: 1,
                    borderColor:
                      state === "error" ? "var(--status-error)"
                      : state === "success" ? "var(--sage)"
                      : "var(--ink)",
                  }}
                  aria-label="Package name"
                />
                <button
                  type="submit"
                  disabled={!valid || state === "installing"}
                  className="wb-btn"
                  style={{ minWidth: 100, justifyContent: "center" }}
                >
                  {state === "installing" ? "installing…" : "install"}
                </button>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
                // must start with claudepanion-
              </div>
              {!valid && pkg.length > 0 && (
                <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--status-warning)" }}>
                  // lowercase / digits / hyphens only
                </div>
              )}

              {state === "installing" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    background: "var(--bg)",
                    border: "1px dashed color-mix(in srgb, var(--ink) 30%, transparent)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--muted)",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span className="wb-pulse" style={{ background: "var(--accent)" }} />
                  <span>running npm install {pkg}…</span>
                </div>
              )}

              {state === "success" && installed && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "color-mix(in srgb, var(--sage) 14%, transparent)",
                    border: "1px solid var(--sage)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: "var(--sage)", marginBottom: 4 }}>
                    ✓ installed <span aria-hidden>{installed.icon}</span> {installed.displayName} v{installed.version}
                  </div>
                  <div style={{ color: "var(--muted)", marginBottom: 10, fontSize: 11 }}>
                    // mounted in sidebar · no restart needed
                  </div>
                  <Link to={`/c/${installed.name}`} className="wb-btn wb-btn-sm" style={{ textDecoration: "none" }}>
                    open companion →
                  </Link>
                </div>
              )}

              {state === "error" && error && (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    background: "color-mix(in srgb, var(--status-error) 8%, transparent)",
                    border: "1px solid var(--status-error)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: "var(--status-error)", marginBottom: 6 }}>install failed</div>
                  <pre style={{ margin: 0, color: "var(--muted)", lineHeight: 1.65, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                    {error}
                  </pre>
                </div>
              )}
            </div>
          </form>

          {/* How it works */}
          <div className="wb-card">
            <div className="wb-card-header wb-section-label">how it works</div>
            <div
              style={{
                padding: "12px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--muted)",
                lineHeight: 1.9,
              }}
            >
              <div>1. type any <code>claudepanion-*</code> package name</div>
              <div>2. host runs <code>npm install</code> + dynamic import</div>
              <div>3. companion contract is validated (manifest, form, tools)</div>
              <div>4. hot-mounted in sidebar · no restart</div>
              <div>5. persisted to <code>companions/index.ts</code></div>
            </div>
          </div>

          <p style={{ marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            // browse all on{" "}
            <a
              href="https://npmjs.com/search?q=claudepanion-"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              npmjs.com →
            </a>
          </p>
        </div>

        {/* Community packages aside */}
        <aside>
          <div style={{ marginBottom: 10 }}>
            <span className="wb-section-label">community packages</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {COMMUNITY_PACKAGES.map((p) => (
              <button
                key={p.name}
                type="button"
                className="wb-chip"
                onClick={() => setPkg(p.name)}
                disabled={state === "installing"}
                style={{
                  padding: "12px 14px",
                  textAlign: "left",
                  display: "grid",
                  gridTemplateColumns: "28px 1fr",
                  gap: 10,
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span style={{ fontSize: 18 }} aria-hidden>{p.icon}</span>
                <div>
                  <div className="wb-sans" style={{ fontWeight: 600, fontSize: 12, color: "var(--ink)", marginBottom: 2 }}>
                    {p.name}
                  </div>
                  <div className="wb-sans" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.45 }}>
                    {p.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--muted)",
              lineHeight: 1.6,
            }}
          >
            // registry is npm<br />
            // search claudepanion on npmjs.com
          </div>
        </aside>
      </div>
    </div>
  );
}
