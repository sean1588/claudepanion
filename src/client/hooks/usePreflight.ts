import { useEffect, useState } from "react";

export interface PreflightStatus {
  ok: boolean;
  missingRequired: string[];
  missingOptional: string[];
  loading: boolean;
}

const INITIAL: PreflightStatus = { ok: true, missingRequired: [], missingOptional: [], loading: true };

export function usePreflight(companion: string | undefined): PreflightStatus {
  const [status, setStatus] = useState<PreflightStatus>(INITIAL);

  useEffect(() => {
    if (!companion) return;
    let cancelled = false;
    setStatus(INITIAL);
    void (async () => {
      try {
        const r = await fetch(`/api/companions/${encodeURIComponent(companion)}/preflight`);
        if (cancelled) return;
        if (r.status === 404) {
          // Treat as no preflight requirement — backwards-compatible.
          setStatus({ ok: true, missingRequired: [], missingOptional: [], loading: false });
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setStatus({ ...data, loading: false });
      } catch {
        if (!cancelled) setStatus({ ok: true, missingRequired: [], missingOptional: [], loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [companion]);

  return status;
}
