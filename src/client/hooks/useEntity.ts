import { useEffect, useRef, useState } from "react";
import type { Entity } from "@shared/types";
import { fetchEntity } from "../api";

const POLL_INTERVAL_MS = 2000;

export function useEntity(companion: string, id: string): { entity: Entity | null; error: Error | null; refetch: () => Promise<void> } {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tick = async () => {
    try {
      const e = await fetchEntity(companion, id);
      setEntity(e);
      setError(null);
      if (e.status === "pending" || e.status === "running") {
        timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    } catch (err) {
      setError(err as Error);
      timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  useEffect(() => {
    void tick();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companion, id]);

  return { entity, error, refetch: tick };
}
