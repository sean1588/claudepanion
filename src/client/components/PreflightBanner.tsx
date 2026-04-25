import { useEffect, useRef } from "react";
import { usePreflight } from "../hooks/usePreflight";

export interface PreflightBannerProps {
  companion: string;
  /** Called whenever the preflight status changes. Useful for the parent form to disable submit. */
  onStatus?: (s: { blocked: boolean; missingRequired: string[]; missingOptional: string[] }) => void;
}

export default function PreflightBanner({ companion, onStatus }: PreflightBannerProps) {
  const status = usePreflight(companion);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    if (status.loading) return;
    onStatusRef.current?.({
      blocked: !status.ok,
      missingRequired: status.missingRequired,
      missingOptional: status.missingOptional,
    });
  }, [status.loading, status.ok, status.missingRequired, status.missingOptional]);

  if (status.loading) return null;
  if (status.ok && status.missingOptional.length === 0) return null;

  if (!status.ok) {
    return (
      <div role="alert" className="preflight-banner preflight-banner-blocking">
        <strong>⚠️ Configuration required.</strong>{" "}
        This companion needs the following environment {status.missingRequired.length === 1 ? "variable" : "variables"} to run:
        <ul style={{ margin: "8px 0 0 20px" }}>
          {status.missingRequired.map((v) => (<li key={v}><code>{v}</code></li>))}
        </ul>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          Set them in your environment, then reload this page.
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="preflight-banner preflight-banner-soft">
      <strong>Optional config not set.</strong>{" "}
      Some features may be limited:
      <ul style={{ margin: "8px 0 0 20px" }}>
        {status.missingOptional.map((v) => (<li key={v}><code>{v}</code></li>))}
      </ul>
    </div>
  );
}
