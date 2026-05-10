import chokidar from "chokidar";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import type { Registry, RegisteredCompanion } from "../companion-registry.js";
import { validateCompanion } from "./validator.js";
import { smokeCompanion } from "./smoke.js";
import type { ValidationReport } from "./validator.js";
import type { SmokeReport } from "./smoke.js";

export class DistStaleError extends Error {
  constructor(public sourcePath: string, public distPath: string) {
    super(`dist file ${distPath} is older than source ${sourcePath}`);
    this.name = "DistStaleError";
  }
}

export function isDistStale(sourcePath: string, distPath: string): boolean {
  try {
    const srcStat = statSync(sourcePath);
    const distStat = statSync(distPath);
    return distStat.mtimeMs < srcStat.mtimeMs;
  } catch {
    return true; // file missing → treat as stale
  }
}

export interface ReliabilitySnapshot {
  validator: ValidationReport;
  smoke: SmokeReport;
  ranAt: string;
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000];

export interface WatcherDeps {
  registry: Registry;
  companionsDir: string;
  debounceMs?: number;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  snapshots?: Map<string, ReliabilitySnapshot>;
  /** Injectable for tests — returns a fresh module import for the given companion name. */
  reimport?: (companionName: string) => Promise<RegisteredCompanion | null>;
  /** Override retry delays (ms) for tests; defaults to [1000, 2000, 4000]. */
  retryDelaysMs?: number[];
}

export interface Watcher {
  close(): Promise<void>;
  /** Exposed for tests to force a remount without filesystem events. */
  triggerRemount(companionName: string): Promise<void>;
}

async function defaultReimport(companionName: string, companionsDir: string): Promise<RegisteredCompanion | null> {
  const distCandidates = [
    resolve(process.cwd(), "dist/companions", companionName, "index.js"),
    resolve(companionsDir, companionName, "index.js"),
  ];
  const sourceCandidate = resolve(companionsDir, companionName, "manifest.ts");
  const cacheBust = `?t=${Date.now()}`;
  for (const distPath of distCandidates) {
    if (isDistStale(sourceCandidate, distPath)) {
      throw new DistStaleError(sourceCandidate, distPath);
    }
    try {
      const mod = await import(`file://${distPath}${cacheBust}`);
      const companion = mod.default ?? mod[companionName] ?? mod[toCamel(companionName)];
      if (companion && companion.manifest) return companion;
    } catch (err) {
      if (err instanceof DistStaleError) throw err;
      // try next candidate for non-stale errors
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
  const retryDelays = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const doRemount = async (companionName: string, retryAttempt = 0): Promise<void> => {
    const reimport = deps.reimport ?? ((n) => defaultReimport(n, deps.companionsDir));
    let fresh: RegisteredCompanion | null = null;
    try {
      fresh = await reimport(companionName);
    } catch (err) {
      if (err instanceof DistStaleError && retryAttempt < retryDelays.length) {
        const delay = retryDelays[retryAttempt];
        logger.info(`[watcher] ${companionName} remount retry ${retryAttempt + 1}/${retryDelays.length} at stage='dist-stale' in ${delay}ms`);
        setTimeout(() => void doRemount(companionName, retryAttempt + 1), delay);
        return;
      }
      logger.warn(`[watcher] ${companionName} remount failed at stage='import-threw': ${(err as Error).message}`);
      return;
    }
    if (!fresh) {
      logger.warn(`[watcher] ${companionName} remount failed at stage='import-empty' (no module returned)`);
      return;
    }
    const companionDir = resolve(deps.companionsDir, companionName);
    const snapshot = await refreshReliability(fresh, companionDir);
    if (!snapshot.validator.ok) {
      const fatals = snapshot.validator.issues.filter((i) => i.fatal).map((i) => i.message).join("; ");
      logger.warn(`[watcher] ${companionName} remount failed at stage='validation-failed': ${fatals}`);
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
