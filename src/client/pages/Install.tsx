import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Manifest } from "@shared/types";

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

  return (
    <>
      <div className="breadcrumb">Install companion</div>
      <div className="page-title">
        <h3>Install companion from npm</h3>
      </div>
      <form onSubmit={submit} style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          Package name
          <input
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
            placeholder="claudepanion-oncall"
            style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}
          />
          <span style={{ fontSize: 11, color: "#64748b" }}>Must start with <code>claudepanion-</code>.</span>
        </label>
        <button className="btn" type="submit" disabled={!valid || state === "installing"} style={{ alignSelf: "flex-start" }}>
          {state === "installing" ? "Installing…" : "Install"}
        </button>

        {state === "error" && error && (
          <pre style={{ background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 8, fontSize: 12, whiteSpace: "pre-wrap", maxWidth: 720 }}>
            {error}
          </pre>
        )}
        {state === "success" && installed && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 600 }}>Installed {installed.icon} {installed.displayName} v{installed.version}</div>
            <button
              type="button"
              onClick={() => navigate(`/c/${installed.name}`)}
              style={{ marginTop: 8, background: "white", border: "1px solid #86efac", color: "#166534", padding: "6px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
            >
              Open →
            </button>
          </div>
        )}
      </form>
    </>
  );
}
