import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Manifest } from "@shared/types";

interface ExamplePackage {
  pkg: string;
  icon: string;
  name: string;
  desc: string;
}

// Placeholder community packages — the registry concept before a real registry
// exists. Clicking one prefills the package name input.
const EXAMPLE_PACKAGES: ExamplePackage[] = [
  { pkg: "claudepanion-oncall",   icon: "🚨", name: "On-call Investigator", desc: "Query CloudWatch + PagerDuty, triage alerts, suggest root causes." },
  { pkg: "claudepanion-standup",  icon: "💬", name: "Standup Summarizer",   desc: "Read Slack channel history, draft a standup, optionally post it back." },
  { pkg: "claudepanion-spend",    icon: "💸", name: "AWS Spend Watcher",    desc: "Query Cost Explorer daily, flag anomalies, email a digest." },
  { pkg: "claudepanion-reviewer", icon: "🔎", name: "PR Reviewer",          desc: "Review GitHub PRs, flag risky diffs, suggest review questions." },
];

export default function Install() {
  const [pkg, setPkg] = useState("");
  const [state, setState] = useState<"idle" | "installing" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Manifest | null>(null);
  const navigate = useNavigate();

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

  const inputBorder =
    state === "error" ? "rgba(192, 70, 61, 0.55)"
    : state === "success" ? "rgba(122, 135, 136, 0.55)"
    : "rgba(21, 24, 26, 0.15)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div className="breadcrumb">
        <span>claudepanion</span>
        <span className="breadcrumb-sep">›</span>
        <span style={{ color: "var(--ink)" }}>Install companion</span>
      </div>

      <div>
        <h1 className="serif" style={{ fontSize: 52, lineHeight: 1.0, margin: "0 0 12px" }}>
          Install from <span className="serif-italic" style={{ color: "var(--accent)" }}>npm</span>.
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", margin: 0, maxWidth: 600, lineHeight: 1.55 }}>
          Any npm package named <code style={chip}>claudepanion-*</code> can be installed here. The host runs <code style={chip}>npm install</code>, validates the companion contract, and mounts it in the sidebar — no restart needed.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 40, alignItems: "start" }}>
        <div>
          {/* Install form */}
          <form
            onSubmit={submit}
            className="card"
            style={{ padding: "22px 24px", marginBottom: 24 }}
          >
            <div className="eyebrow" style={{ marginBottom: 14 }}>Package name</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <input
                value={pkg}
                onChange={(e) => setPkg(e.target.value)}
                placeholder="claudepanion-oncall"
                disabled={state === "installing"}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  border: `1px solid ${inputBorder}`,
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "var(--font-mono)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
              />
              <button
                type="submit"
                className="btn"
                disabled={!valid || state === "installing"}
                style={{ borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
              >
                {state === "installing" && <Spinner />}
                {state === "installing" ? "Installing…" : "Install"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Must start with <code style={chip}>claudepanion-</code> · any valid npm package name
            </div>

            {state === "installing" && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  background: "var(--soft)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--muted)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Spinner />
                <span>
                  Running <code style={chip}>npm install {pkg}</code>…
                </span>
              </div>
            )}

            {state === "success" && installed && (
              <div
                style={{
                  marginTop: 16,
                  padding: "14px 16px",
                  background: "rgba(122, 135, 136, 0.1)",
                  border: "1px solid rgba(122, 135, 136, 0.3)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--sage)", marginBottom: 4, fontSize: 14 }}>
                  ✓ Installed {installed.icon} {installed.displayName} v{installed.version}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                  Mounted in the sidebar. No restart needed.
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/c/${installed.name}`)}
                  className="btn"
                  style={{ borderRadius: 6, padding: "7px 14px", fontSize: 12, minHeight: 0 }}
                >
                  Open companion →
                </button>
              </div>
            )}

            {state === "error" && error && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  background: "rgba(192, 70, 61, 0.06)",
                  border: "1px solid rgba(192, 70, 61, 0.3)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontWeight: 600, color: "#C0463D", marginBottom: 6, fontSize: 13 }}>
                  Install failed
                </div>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--muted)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                  }}
                >
                  {error}
                </pre>
              </div>
            )}
          </form>

          {/* How it works */}
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>How it works</div>
            <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Type any <code style={chip}>claudepanion-*</code> package name</li>
              <li>The host runs <code style={chip}>npm install</code> and dynamically imports it</li>
              <li>The companion contract is validated (manifest, form, tools)</li>
              <li>It mounts in the sidebar without a restart</li>
              <li>The install is persisted to <code style={chip}>companions/index.ts</code></li>
            </ol>
          </div>
        </div>

        {/* Community packages aside */}
        <aside>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Community packages</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {EXAMPLE_PACKAGES.map((p) => (
              <button
                key={p.pkg}
                type="button"
                onClick={() => setPkg(p.pkg)}
                disabled={state === "installing"}
                className="card-bordered"
                style={{
                  padding: "14px 16px",
                  textAlign: "left",
                  fontFamily: "inherit",
                  font: "inherit",
                  color: "inherit",
                  cursor: state === "installing" ? "not-allowed" : "pointer",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  background: "var(--bg)",
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden="true">{p.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.45, marginBottom: 6 }}>{p.desc}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{p.pkg}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)", lineHeight: 1.55 }}>
            The registry is npm. Search{" "}
            <a
              href="https://www.npmjs.com/search?q=claudepanion-"
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "var(--accent)", textDecoration: "none" }}
            >
              npmjs.com/search?q=claudepanion-
            </a>{" "}
            for more.
          </div>
        </aside>
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  background: "var(--soft)",
  padding: "2px 7px",
  borderRadius: 4,
  fontSize: "0.9em",
  fontFamily: "var(--font-mono)",
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
