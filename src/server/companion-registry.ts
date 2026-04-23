import type { Manifest } from "../shared/types.js";

export const SUPPORTED_CONTRACT_VERSION = "1";

export interface RegisteredCompanion {
  manifest: Manifest;
  tools: Record<string, ToolHandler>;
}

export type ToolHandler = (args: unknown) => Promise<unknown> | unknown;

export interface Registry {
  list(): RegisteredCompanion[];
  get(name: string): RegisteredCompanion | null;
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
  return {
    list: () => [...byName.values()],
    get: (name) => byName.get(name) ?? null,
  };
}
