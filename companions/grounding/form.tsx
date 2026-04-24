import { useState } from "react";
import type { GroundingInput } from "./types";

interface Props {
  onSubmit: (input: GroundingInput) => void | Promise<void>;
}

export default function GroundingForm({ onSubmit }: Props) {
  const [focus, setFocus] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = focus.trim();
    void onSubmit(trimmed ? { focus: trimmed } : {});
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Focus area <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span>
        <textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          rows={3}
          placeholder='e.g. "plugin system" or "companion contract" — leave blank for a full overview'
          style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical" as const }}
        />
      </label>
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Run</button>
    </form>
  );
}
