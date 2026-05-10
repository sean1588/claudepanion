import { useEffect, useState } from "react";

export interface McpStatus {
  firstRequestAt: string | null;
  lastRequestAt: string | null;
  loading: boolean;
}

const INITIAL: McpStatus = { firstRequestAt: null, lastRequestAt: null, loading: true };
const POLL_INTERVAL_MS = 5000;

export function useMcpStatus(active: boolean): McpStatus {
  const [status, setStatus] = useState<McpStatus>(INITIAL);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const r = await fetch("/api/mcp/status");
        if (cancelled) return;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setStatus({ firstRequestAt: data.firstRequestAt ?? null, lastRequestAt: data.lastRequestAt ?? null, loading: false });
      } catch {
        if (!cancelled) setStatus((s) => ({ ...s, loading: false }));
      }
    };

    void tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [active]);

  return status;
}
