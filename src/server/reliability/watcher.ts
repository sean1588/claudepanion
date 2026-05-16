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

/** What the user should do to recover a companion that failed to mount. */
export type MountRemedy = "restart" | "rebuild" | "fix-code";

export interface MountFailure {
  slug: string;
  /** Where in the remount pipeline it failed — for debugging, not user-facing. */
  stage: "import-threw" | "import-empty" | "dist-stale" | "validation-failed";
  message: string;
  /** Drives the UI's recovery instruction so the client doesn't string-match. */
  remedy: MountRemedy;
  /** ISO timestamp of the failure. */
  at: string;
}

/**
 * Maps a remount error message to the action that actually fixes it.
 *
 * - Node ESM module-resolution failures ("Cannot find package/module",
 *   ERR_MODULE_NOT_FOUND) mean the companion imports a dependency that isn't
 *   resolvable in the *running* process — typically npm-installed after the
 *   server booted. A fresh `claudepanion serve` re-resolves it → "restart".
 * - A stale dist artifact (source newer than compiled output) needs a
 *   recompile → "rebuild".
 * - Anything else (syntax error, bad export, validation failure) is a problem
 *   in the companion's own code the user must fix → "fix-code".
 */
export function classifyMountFailure(message: string): MountRemedy {
  if (/ERR_MODULE_NOT_FOUND|Cannot find package|Cannot find module/i.test(message)) {
    return "restart";
  }
  if (/is older than source|DistStaleError/i.test(message)) {
    return "rebuild";
  }
  return "fix-code";
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000];

export interface WatcherDeps {
  registry: Registry;
  companionsDir: string;
  debounceMs?: number;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  snapshots?: Map<string, ReliabilitySnapshot>;
  /** Records remount failures so the UI can tell the user a companion built
   *  but isn't loaded (and what to do about it). Cleared on success. */
  mountFailures?: Map<string, MountFailure>;
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

/** Returns the most-recent mtime among the source files that, when changed, mean
 *  the dist artifact is stale. Considers manifest.ts and index.ts (the codegen
 *  output written by `claudepanion scaffold` after the file watcher fires). */
function newestSourceMtimeMs(companionsDir: string, companionName: string): number {
  const candidates = [
    resolve(companionsDir, companionName, "manifest.ts"),
    resolve(companionsDir, companionName, "index.ts"),
    resolve(companionsDir, companionName, "types.ts"),
    resolve(companionsDir, companionName, "server/tools.ts"),
  ];
  let max = 0;
  for (const p of candidates) {
    try {
      const s = statSync(p);
      if (s.mtimeMs > max) max = s.mtimeMs;
    } catch {
      // missing file is fine — just don't contribute to max
    }
  }
  return max;
}

async function defaultReimport(companionName: string, companionsDir: string): Promise<RegisteredCompanion | null> {
  const distPath = resolve(process.cwd(), "dist/companions", companionName, "index.js");

  // Stale gate: dist must be at least as new as the newest authored source file.
  let distMtime: number;
  try {
    distMtime = statSync(distPath).mtimeMs;
  } catch {
    throw new DistStaleError(resolve(companionsDir, companionName, "manifest.ts"), distPath);
  }
  const srcMtime = newestSourceMtimeMs(companionsDir, companionName);
  if (distMtime < srcMtime) {
    throw new DistStaleError(resolve(companionsDir, companionName, "manifest.ts"), distPath);
  }

  // Import — surface real errors rather than swallowing them.
  const cacheBust = `?t=${Date.now()}`;
  const mod = await import(`file://${distPath}${cacheBust}`);
  const companion = mod.default ?? mod[companionName] ?? mod[toCamel(companionName)];
  if (!companion?.manifest) {
    throw new Error(
      `dist module at ${distPath} loaded but did not export a RegisteredCompanion ` +
      `(expected a default export, or a named export 'default'/'${companionName}'/'${toCamel(companionName)}' with a .manifest property)`
    );
  }
  return companion;
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

  const recordFailure = (slug: string, stage: MountFailure["stage"], message: string) => {
    deps.mountFailures?.set(slug, {
      slug,
      stage,
      message,
      remedy: classifyMountFailure(message),
      at: new Date().toISOString(),
    });
  };

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
      const stage = err instanceof DistStaleError ? "dist-stale" : "import-threw";
      logger.warn(`[watcher] ${companionName} remount failed at stage='${stage}': ${(err as Error).message}`);
      recordFailure(companionName, stage, (err as Error).message);
      return;
    }
    if (!fresh) {
      logger.warn(`[watcher] ${companionName} remount failed at stage='import-empty' (no module returned)`);
      recordFailure(companionName, "import-empty", "module loaded but did not export a RegisteredCompanion");
      return;
    }
    const companionDir = resolve(deps.companionsDir, companionName);
    const snapshot = await refreshReliability(fresh, companionDir);
    if (!snapshot.validator.ok) {
      const fatals = snapshot.validator.issues.filter((i) => i.fatal).map((i) => i.message).join("; ");
      logger.warn(`[watcher] ${companionName} remount failed at stage='validation-failed': ${fatals}`);
      if (snapshots) snapshots.set(companionName, snapshot);
      recordFailure(companionName, "validation-failed", fatals);
      return;
    }
    deps.registry.remount(fresh);
    if (snapshots) snapshots.set(companionName, snapshot);
    deps.mountFailures?.delete(companionName);
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
