import { useState } from "react";
import type { BuildInput } from "./types";

interface Props {
  onSubmit: (input: BuildInput) => void | Promise<void>;
}

const inputStyle = { padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 };
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13 };

export default function BuildForm({ onSubmit }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"entity" | "tool">("entity");
  const [description, setDescription] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nm = name.trim();
    const desc = description.trim();
    if (!nm || !/^[a-z][a-z0-9-]*$/.test(nm) || !desc) return;
    void onSubmit({ mode: "new-companion", name: nm, kind, description: desc });
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={labelStyle}>
        Companion name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="oncall-investigator"
          style={inputStyle}
          pattern="^[a-z][a-z0-9-]*$"
        />
        <span style={{ fontSize: 11, color: "#64748b" }}>lowercase, hyphens, starts with a letter</span>
      </label>
      <label style={labelStyle}>
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value as "entity" | "tool")} style={inputStyle}>
          <option value="entity">entity — has lifecycle, form, artifacts</option>
          <option value="tool">tool — MCP tools only, auto About page</option>
        </select>
      </label>
      <label style={labelStyle}>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Triage oncall alerts from the last 24h and summarize the top three."
          style={{ ...inputStyle, resize: "vertical" as const }}
        />
      </label>
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>
        Scaffold companion
      </button>
    </form>
  );
}
