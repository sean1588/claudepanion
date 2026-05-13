import { useEffect, useRef, useState } from "react";
import { fetchEntity as realFetchEntity } from "../api";
import type { Entity } from "@shared/types";

const POLL_MS = 2_000;
const TERMINAL: Entity["status"][] = ["completed", "error"];

interface Options { fetchEntity?: (companion: string, id: string) => Promise<Entity> }

export function useEntityPolling(companion: string, id: string, opts: Options = {}): { entity: Entity | null; isPolling: boolean } {
  const fetcher = opts.fetchEntity ?? realFetchEntity;
  const [entity, setEntity] = useState<Entity | null>(null);
  const entityRef = useRef<Entity | null>(null);
  useEffect(() => { entityRef.current = entity; }, [entity]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const next = await fetcher(companion, id);
        if (cancelled) return;
        setEntity(next);
        if (TERMINAL.includes(next.status) && intervalId !== null) {
          clearInterval(intervalId); intervalId = null;
        }
      } catch {
        /* network blip — keep last good state */
      }
    };

    const onVisibility = () => {
      if (document.hidden && intervalId !== null) {
        clearInterval(intervalId); intervalId = null;
      } else if (!document.hidden && intervalId === null) {
        const current = entityRef.current;
        if (current && !TERMINAL.includes(current.status)) {
          intervalId = setInterval(tick, POLL_MS);
        }
      }
    };

    void tick();
    intervalId = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [companion, id]);

  return { entity, isPolling: entity ? !TERMINAL.includes(entity.status) : true };
}
