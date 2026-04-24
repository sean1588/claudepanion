import chokidar from "chokidar";
import { resolve } from "node:path";
import type { Registry, RegisteredCompanion } from "../companion-registry.js";
import { validateCompanion } from "./validator.js";
import { smokeCompanion } from "./smoke.js";
import type { ValidationReport } from "./validator.js";
import type { SmokeReport } from "./smoke.js";

export interface ReliabilitySnapshot {
  validator: ValidationReport;
  smoke: SmokeReport;
  ranAt: string;
}

export interface WatcherDeps {
  registry: Registry;
  companionsDir: string;
  debounceMs?: number;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  snapshots?: Map<string, ReliabilitySnapshot>;
  /** Injectable for tests — returns a fresh module import for the given companion name. */
  reimport?: (companionName: string) => Promise<RegisteredCompanion | null>;
}

export interface Watcher {
  close(): Promise<void>;
  /** Exposed for tests to force a remount without filesystem events. */
  triggerRemount(companionName: string): Promise<void>;
}

async function defaultReimport(companionName: string, companionsDir: string): Promise<RegisteredCompanion | null> {
  const candidates = [
    resolve(process.cwd(), "dist/companions", companionName, "index.js"),
    resolve(companionsDir, companionName, "index.js"),
  ];
  const cacheBust = `?t=${Date.now()}`;
  for (const path of candidates) {
    try {
      const mod = await import(`file://${path}${cacheBust}`);
      const companion = mod.default ?? mod[companionName] ?? mod[toCamel(companionName)];
      if (companion && companion.manifest) return companion;
    } catch {
      // try next
    }
  }
  return null;
}

function toCamel(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export async function refreshReliability(companion: RegisteredCompanion, companionDir: string | null): Promise<ReliabilitySnapshot> {
  const validator = validateCompanion({ manifest: companion.manifest, module: companion, companionDir });
  const smoke = await smokeCompanion(companion);
  return { validator, smoke, ranAt: new Date().toISOString() };
}

export function createWatcher(deps: WatcherDeps): Watcher {
  const debounceMs = deps.debounceMs ?? 200;
  const logger = deps.logger ?? { info: console.log.bind(console), warn: console.warn.bind(console) };
  const snapshots = deps.snapshots;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const doRemount = async (companionName: string) => {
    const reimport = deps.reimport ?? ((n) => defaultReimport(n, deps.companionsDir));
    const fresh = await reimport(companionName);
    if (!fresh) {
      logger.warn(`[watcher] could not re-import ${companionName}`);
      return;
    }
    const companionDir = resolve(deps.companionsDir, companionName);
    const snapshot = await refreshReliability(fresh, companionDir);
    if (!snapshot.validator.ok) {
      const fatals = snapshot.validator.issues.filter((i) => i.fatal).map((i) => i.message).join("; ");
      logger.warn(`[watcher] ${companionName} failed validation, keeping old mount: ${fatals}`);
      if (snapshots) snapshots.set(companionName, snapshot);
      return;
    }
    deps.registry.remount(fresh);
    if (snapshots) snapshots.set(companionName, snapshot);
    logger.info(`[watcher] remounted ${companionName} (v${fresh.manifest.version})`);
  };

  const schedule = (companionName: string) => {
    const existing = timers.get(companionName);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      timers.delete(companionName);
      void doRemount(companionName);
    }, debounceMs);
    timers.set(companionName, t);
  };

  const watcher = chokidar.watch(deps.companionsDir, {
    ignoreInitial: true,
    persistent: true,
    depth: 2,
    ignored: (p) => /\/(node_modules|\.git|data|dist)\//.test(p),
  });

  const handle = (path: string) => {
    if (!/\/(manifest|index)\.(ts|js)$/.test(path)) return;
    const m = path.match(/companions\/([^/]+)\/(manifest|index)\.[tj]s$/);
    if (m && m[2] === "manifest") schedule(m[1]);
    else if (m && m[2] === "index") {
      // companions/<name>/index.{ts,js}
      schedule(m[1]);
    } else if (/\/companions\/index\.(ts|js)$/.test(path)) {
      // top-level index changed — remount all
      for (const c of deps.registry.list()) schedule(c.manifest.name);
    }
  };
  watcher.on("change", handle);
  watcher.on("add", handle);

  // Seed initial reliability reports for all companions
  if (snapshots) {
    void (async () => {
      for (const c of deps.registry.list()) {
        const companionDir = resolve(deps.companionsDir, c.manifest.name);
        snapshots.set(c.manifest.name, await refreshReliability(c, companionDir));
      }
    })();
  }

  return {
    close: () => watcher.close(),
    triggerRemount: doRemount,
  };
}
