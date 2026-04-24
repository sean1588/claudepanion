import { useCallback, useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { fetchCompanions } from "../api";

const POLL_MS = 5000;

export function useCompanions(): { companions: Manifest[]; loading: boolean; refetch: () => Promise<void> } {
  const [companions, setCompanions] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const m = await fetchCompanions();
      setCompanions(m);
    } catch {
      // swallow — keep stale list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    const t = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(t);
  }, [refetch]);

  return { companions, loading, refetch };
}
