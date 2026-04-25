import type { Manifest, CompanionToolDefinition } from "../shared/types.js";

export const SUPPORTED_CONTRACT_VERSION = "1";

export interface RegisteredCompanion {
  manifest: Manifest;
  /** Domain proxy tools defined by the companion. Generic entity tools (_get, _update_status,
   *  _append_log, _save_artifact, _fail) are auto-registered by the host — don't include them here. */
  tools: CompanionToolDefinition[];
  /** "local" = lives in companions/<slug>/; "installed" = npm package claudepanion-<slug>. */
  source?: "local" | "installed";
}

export interface Registry {
  list(): RegisteredCompanion[];
  get(name: string): RegisteredCompanion | null;
  remount(companion: RegisteredCompanion): void;
  register(companion: RegisteredCompanion): void;
  onChange(listener: (name: string) => void): () => void;
}

export function createRegistry(companions: RegisteredCompanion[]): Registry {
  for (const c of companions) {
    if (c.manifest.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
      throw new Error(
        `companion ${c.manifest.name} declares contractVersion=${c.manifest.contractVersion}; host supports ${SUPPORTED_CONTRACT_VERSION}`
      );
    }
  }
  const byName = new Map(companions.map((c) => [c.manifest.name, c]));
  const listeners = new Set<(name: string) => void>();
  return {
    list: () => [...byName.values()],
    get: (name) => byName.get(name) ?? null,
    remount: (c) => {
      if (c.manifest.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
        throw new Error(
          `companion ${c.manifest.name} declares contractVersion=${c.manifest.contractVersion}; host supports ${SUPPORTED_CONTRACT_VERSION}`
        );
      }
      byName.set(c.manifest.name, c);
      for (const l of listeners) l(c.manifest.name);
    },
    register: (c) => {
      if (c.manifest.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
        throw new Error(
          `companion ${c.manifest.name} declares contractVersion=${c.manifest.contractVersion}; host supports ${SUPPORTED_CONTRACT_VERSION}`
        );
      }
      if (byName.has(c.manifest.name)) {
        throw new Error(`companion ${c.manifest.name} already registered; use remount to swap`);
      }
      byName.set(c.manifest.name, c);
      for (const l of listeners) l(c.manifest.name);
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
