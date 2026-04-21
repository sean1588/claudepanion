import type { Broadcast } from './types.js';

export interface Broadcaster {
  broadcast: Broadcast;
  subscribe(listener: Broadcast): () => void;
}

export function createBroadcaster(): Broadcaster {
  const listeners = new Set<Broadcast>();
  return {
    broadcast(event, data) {
      for (const l of listeners) {
        try { l(event, data); } catch { /* isolate failures */ }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
