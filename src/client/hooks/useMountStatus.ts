import { useEffect, useState } from "react";
import { fetchMountStatus, type MountStatus } from "../api";

// Polls so that after the user restarts `claudepanion serve` (or rebuilds),
// the page recovers on its own without a manual refresh.
const POLL_MS = 3000;

export function useMountStatus(slug: string | undefined, active: boolean): MountStatus | null {
  const [status, setStatus] = useState<MountStatus | null>(null);
  useEffect(() => {
    if (!active || !slug) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await fetchMountStatus(slug);
        if (!cancelled) setStatus(s);
      } catch {
        /* network glitch — keep last value */
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [slug, active]);
  return status;
}
