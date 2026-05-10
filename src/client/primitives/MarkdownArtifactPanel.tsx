import ReactMarkdown from "react-markdown";
import type { BaseArtifact } from "../../shared/types.js";

interface Props {
  artifact: BaseArtifact;
  /** Set true for standalone use (renders summary header + errors callout + markdown body).
   *  Defaults to false because the host's <BaseArtifactPanel> wrapper already renders the
   *  summary banner and errors callout; this primitive is typically used as just the body
   *  slot inside that wrapper, so it would duplicate them otherwise. */
  standalone?: boolean;
}

export function MarkdownArtifactPanel({ artifact, standalone = false }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {standalone && artifact.summary && (
        <h1 style={{ margin: 0, fontSize: 20 }}>{artifact.summary}</h1>
      )}
      {standalone && artifact.errors && artifact.errors.length > 0 && (
        <div style={{
          border: "1px solid #f59e0b",
          background: "#fffbeb",
          borderRadius: 6,
          padding: "8px 12px",
        }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: "#92400e", marginBottom: 4 }}>
            ⚠ Notes during this run
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {artifact.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {artifact.markdown ? (
        <div className="markdown-body">
          <ReactMarkdown>{artifact.markdown}</ReactMarkdown>
        </div>
      ) : (
        <div style={{ color: "var(--muted)", fontStyle: "italic" }}>
          No markdown report generated. (This may be a legacy entity from before the v2 contract.)
        </div>
      )}
    </div>
  );
}

export default MarkdownArtifactPanel;
