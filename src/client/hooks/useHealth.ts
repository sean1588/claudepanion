import { useEffect, useState } from "react";

export interface Health {
  host: "running";
  pluginInstalled: boolean | null;
  mcp: { firstRequestAt: string | null; lastRequestAt: string | null };
}

const POLL_MS = 5_000;

export function useHealth(): Health | null {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) return;
        const data = (await res.json()) as Health;
        if (!cancelled) setHealth(data);
      } catch {
        /* network glitch — keep last good value */
      }
    };
    void fetchOnce();
    const id = setInterval(fetchOnce, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return health;
}
