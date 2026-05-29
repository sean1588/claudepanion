import { useParams } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import { useMountStatus } from "../hooks/useMountStatus";
import type { MountFailure } from "../api";
import BuildHome from "./BuildHome";
import CompanionAbout from "./CompanionAbout";
import ToolAbout from "./ToolAbout";

export default function CompanionRoute() {
  const { companion } = useParams<{ companion: string }>();
  const { companions, loading } = useCompanions();
  if (loading) return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  const manifest = companions.find((c) => c.name === companion);
  if (!manifest) return <CompanionNotMounted slug={companion ?? ""} />;
  if (manifest.name === "build") return <BuildHome />;
  return manifest.kind === "tool" ? <ToolAbout /> : <CompanionAbout />;
}

function CompanionNotMounted({ slug }: { slug: string }) {
  const status = useMountStatus(slug, true);
  if (!status) return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  // mount-status caught up before the companions list did — let the poll resolve it.
  if (status.mounted) return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  if (!status.failure) {
    return <div style={{ color: "var(--status-error)" }}>Unknown companion: {slug}</div>;
  }
  return <MountFailurePanel slug={slug} failure={status.failure} />;
}

function MountFailurePanel({ slug, failure }: { slug: string; failure: MountFailure }) {
  const { headline, steps } = remedyCopy(slug, failure.remedy);
  const accent =
    failure.remedy === "fix-code" ? "var(--status-error)" : "var(--status-warning)";
  return (
    <div style={{ padding: "22px 28px 60px", maxWidth: 720 }}>
      <div className="wb-card" style={{ borderColor: accent, marginBottom: 12 }}>
        <div
          className="wb-card-header wb-section-label"
          style={{ color: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)`, borderBottomColor: `color-mix(in srgb, ${accent} 40%, transparent)` }}
        >
          // {failure.remedy === "fix-code" ? "load error" : "needs restart"}
        </div>
        <div style={{ padding: "14px" }}>
          <h1 className="wb-serif" style={{ fontSize: 28, margin: "0 0 12px" }}>{headline}</h1>
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>
            {steps.map((s) => (
              <li key={s} style={{ lineHeight: 1.55 }}>{s}</li>
            ))}
          </ol>
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              // why it didn't load
            </summary>
            <pre className="wb-code" style={{ marginTop: 8, padding: "8px 12px", fontSize: 11, whiteSpace: "pre-wrap" }}>
              {failure.stage}: {failure.message}
            </pre>
          </details>
        </div>
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0 }}>
        // this page refreshes on its own once <code>{slug}</code> loads.
      </p>
    </div>
  );
}

function remedyCopy(slug: string, remedy: MountFailure["remedy"]): { headline: string; steps: string[] } {
  if (remedy === "restart") {
    return {
      headline: `${slug} was built, but the server needs a restart to load it`,
      steps: [
        `${slug} pulled in a new dependency that the running claudepanion server can't see yet.`,
        "Stop the server (Ctrl-C in the terminal running `claudepanion serve`).",
        "Run `claudepanion serve` again.",
      ],
    };
  }
  if (remedy === "rebuild") {
    return {
      headline: `${slug} was built, but its compiled output is stale`,
      steps: [
        `Ask Build to iterate on ${slug} (or run \`claudepanion scaffold ${slug}\`) — that recompiles it.`,
        `${slug} will load automatically once the recompile finishes — no restart needed.`,
      ],
    };
  }
  return {
    headline: `${slug} was built, but failed to load`,
    steps: [
      "There's an error in the companion's code (see details below).",
      "Ask Build to iterate on it, or fix it directly — it reloads automatically once the error is resolved.",
    ],
  };
}
