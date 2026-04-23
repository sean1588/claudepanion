import { useState } from "react";
import type { ExpenseInput } from "./types";

interface Props {
  onSubmit: (input: ExpenseInput) => void | Promise<void>;
}

export default function ExpenseForm({ onSubmit }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!description.trim() || !Number.isFinite(amt)) return;
    void onSubmit({ description: description.trim(), amount: amt });
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Amount
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
      </label>
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Create</button>
    </form>
  );
}
