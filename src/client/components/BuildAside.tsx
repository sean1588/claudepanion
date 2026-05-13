interface Example {
  slug: string;
  displayName: string;
  icon: string;
}

const EXAMPLES: Example[] = [
  { slug: "pr-reviewer", displayName: "GitHub PR reviewer", icon: "🔎" },
  { slug: "cloudwatch", displayName: "CloudWatch investigator", icon: "📊" },
  { slug: "linear", displayName: "Linear backlog groomer", icon: "📋" },
];

const CREATED_FILES = (slug: string) => [
  "manifest.ts + index.ts",
  "types.ts (Input + Artifact)",
  "form.tsx",
  "pages/List.tsx + Detail.tsx",
  "server/tools.ts",
  `skills/${slug}/SKILL.md`,
];

interface Props {
  example: Example | null;
  onPick: (slug: string) => void;
}

export default function BuildAside({ example, onPick }: Props) {
  if (example) {
    return (
      <aside style={{ position: "sticky", top: 24 }}>
        <div style={{ border: "1px solid color-mix(in srgb, var(--sage) 35%, transparent)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "color-mix(in srgb, var(--sage) 10%, transparent)", borderBottom: "1px solid color-mix(in srgb, var(--sage) 20%, transparent)", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }} aria-hidden>{example.icon}</span>
            <div>
              <div className="t-h3">Starting from example</div>
              <div className="t-caption">{example.displayName}</div>
            </div>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div className="t-eyebrow" style={{ marginBottom: 4 }}>What Build will create</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {CREATED_FILES(example.slug).map((f) => (
                  <li key={f} className="t-mono" style={{ fontSize: 12, lineHeight: 1.8, color: "var(--ink)" }}>{f}</li>
                ))}
              </ul>
            </div>
            <div style={{ paddingTop: 10, borderTop: "1px solid color-mix(in srgb, var(--ink) 6%, transparent)" }}>
              <div className="t-eyebrow" style={{ marginBottom: 4 }}>After submitting</div>
              <p className="t-caption" style={{ margin: 0 }}>
                A pending entity appears. Run the slash command in Claude Code — Build scaffolds, validates, and mounts the
                companion without a restart.
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }
  return (
    <aside style={{ position: "sticky", top: 24 }}>
      <div className="card-soft">
        <div className="t-h3" style={{ marginBottom: 8 }}>Or start from an example</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex.slug} type="button" className="btn-chip" onClick={() => onPick(ex.slug)} style={{ justifyContent: "flex-start", padding: "10px 12px", borderRadius: 6, fontSize: 13 }}>
              <span aria-hidden>{ex.icon}</span>
              <span style={{ color: "var(--ink)" }}>{ex.displayName}</span>
              <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 16 }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
