import { useState } from "react";

interface Props {
  title: string;
  hint: string;
  cta: string;
  placeholder: string;
  onSubmit: (text: string) => void;
}

export default function ContinuationForm({ title, hint, cta, placeholder, onSubmit }: Props) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText("");
  };
  return (
    <div className="continuation">
      <div className="continuation-title">{title}</div>
      <div className="continuation-hint">{hint}</div>
      <div className="continuation-row">
        <input
          className="continuation-input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <button className="btn" onClick={submit}>{cta}</button>
      </div>
    </div>
  );
}
