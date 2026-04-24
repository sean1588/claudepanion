import { useState } from "react";

interface Props {
  command: string;
  /** Optional note rendered below the command — useful for telling the user which repo to run Claude Code from. */
  note?: string;
}

export default function SlashCommandBlock({ command, note }: Props) {
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
      {note && <div className="slash-command-note">{note}</div>}
    </div>
  );
}
