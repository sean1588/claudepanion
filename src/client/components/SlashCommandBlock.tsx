import { useState } from "react";

export default function SlashCommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="slash-command">
      <div className="slash-command-label">Hand off to Claude</div>
      <div className="slash-command-hint">Paste this in Claude Code to start work on this entity:</div>
      <div className="slash-command-row">
        <div className="slash-command-code">{command}</div>
        <button className="slash-command-copy" onClick={copy}>{copied ? "✓ Copied" : "📋 Copy"}</button>
      </div>
    </div>
  );
}
