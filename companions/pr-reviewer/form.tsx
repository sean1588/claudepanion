import { useState } from "react";
import type { prReviewerInput } from "./types";

interface Props {
  onSubmit: (input: prReviewerInput) => void | Promise<void>;
}

export default function prReviewerForm({ onSubmit }: Props) {
  const [description, setDescription] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = description.trim();
    if (!desc) return;
    void onSubmit({ description: desc });
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
      </label>
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Create</button>
    </form>
  );
}
