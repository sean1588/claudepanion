import { useState } from "react";
import type { __PASCAL__Input } from "./types";

interface Props {
  onSubmit: (input: __PASCAL__Input) => void | Promise<void>;
}

export default function __PASCAL__Form({ onSubmit }: Props) {
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setError("Description is required."); return; }
    setError(null);
    void onSubmit({ description: description.trim() });
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical" as const }}
        />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Create</button>
    </form>
  );
}
