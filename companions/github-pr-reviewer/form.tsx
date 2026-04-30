import { useState } from "react";
import type { GithubPrReviewerInput } from "./types";

interface Props {
  onSubmit: (input: GithubPrReviewerInput) => void | Promise<void>;
}

const inputStyle = { padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 };
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13 };

export default function GithubPrReviewerForm({ onSubmit }: Props) {
  const [repo, setRepo] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [focus, setFocus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = repo.trim();
    const n = parseInt(prNumber, 10);
    if (!r) { setError("Repository is required (e.g. owner/repo)."); return; }
    if (!/^[^/]+\/[^/]+$/.test(r)) { setError("Repository must be in owner/repo format."); return; }
    if (!prNumber || isNaN(n) || n < 1) { setError("PR number must be a positive integer."); return; }
    setError(null);
    void onSubmit({ repo: r, prNumber: n, focus: focus.trim() || undefined });
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 16 }}>
      <label style={labelStyle}>
        Repository
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="owner/repo"
          style={inputStyle}
          required
        />
        <span style={{ fontSize: 11, color: "#64748b" }}>e.g. anthropics/claude-manager</span>
      </label>

      <label style={labelStyle}>
        PR number
        <input
          type="number"
          value={prNumber}
          onChange={(e) => setPrNumber(e.target.value)}
          placeholder="42"
          min={1}
          style={inputStyle}
          required
        />
      </label>

      <label style={labelStyle}>
        Focus (optional)
        <input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="e.g. auth logic, error handling, test coverage"
          style={inputStyle}
        />
        <span style={{ fontSize: 11, color: "#64748b" }}>Narrows which risks and questions Claude prioritizes.</span>
      </label>

      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>
        Review PR
      </button>
    </form>
  );
}
