import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { activatePlugin, type ActivateResult, type RunClaude } from "./claude-plugin.js";

export interface PluginInstallOptions {
  scope: "global" | "repo";
  /** Defaults to os.homedir(). Override for tests. */
  userHome?: string;
  /** Required when scope === "repo". The git-root path. */
  repoRoot?: string;
  /** Framework package root — not currently used in settings.json but kept for forward compat. */
  frameworkRoot: string;
}

export type PluginInstallResult =
  | { ok: true; settingsPath: string }
  | { ok: false; error: string };

const PLUGIN_NAME = "claudepanion@local";

function userHomeOrDefault(opts: { userHome?: string }): string {
  return opts.userHome ?? process.env.HOME ?? homedir();
}

function claudepanionHome(userHome: string): string {
  return join(userHome, ".claudepanion");
}

function settingsPathFor(scope: "global" | "repo", opts: PluginInstallOptions): string {
  const userHome = userHomeOrDefault(opts);
  if (scope === "global") return join(userHome, ".claude/settings.json");
  if (!opts.repoRoot) throw new Error("repo scope requires repoRoot");
  return join(opts.repoRoot, ".claude/settings.local.json");
}

function readJson(path: string): Record<string, unknown> {
  try { return JSON.parse(readFileSync(path, "utf-8")); }
  catch { return {}; }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

export async function runPluginInstall(opts: PluginInstallOptions): Promise<PluginInstallResult> {
  const userHome = userHomeOrDefault(opts);
  const home = claudepanionHome(userHome);
  if (!existsSync(home)) {
    return { ok: false, error: `${home} not found. Run 'claudepanion init' first.` };
  }
  const settingsPath = settingsPathFor(opts.scope, opts);
  const settings = readJson(settingsPath);

  const enabledPlugins = (settings.enabledPlugins ?? {}) as Record<string, boolean>;
  enabledPlugins[PLUGIN_NAME] = true;
  settings.enabledPlugins = enabledPlugins;

  const marketplaces = (settings.extraKnownMarketplaces ?? {}) as Record<string, unknown>;
  marketplaces.local = { source: { source: "directory", path: home } };
  settings.extraKnownMarketplaces = marketplaces;

  // Grant Claude Code read/write access to the user-local install regardless
  // of the workspace it was opened in, so /build-companion can author files
  // at ~/.claudepanion/companions/<slug>/.
  const additionalDirectories = (settings.additionalDirectories ?? []) as string[];
  if (!additionalDirectories.includes(home)) {
    additionalDirectories.push(home);
  }
  settings.additionalDirectories = additionalDirectories;

  writeJson(settingsPath, settings);
  return { ok: true, settingsPath };
}

export type ProbeFn = (url: string) => Promise<{ ok: boolean; status?: number }>;

export interface ServerProbe {
  /** Port parsed from ~/.claudepanion/.mcp.json, or null if missing/unparseable. */
  port: number | null;
  reachable: boolean;
  /** /api/mcp/status responded ok (only meaningful when reachable). */
  mcpOk?: boolean;
  detail?: string;
}

export interface ActivateReport {
  activation: ActivateResult;
  server: ServerProbe;
}

const defaultProbe: ProbeFn = async (url) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
};

function parseMcpPort(home: string): number | null {
  try {
    const j = JSON.parse(readFileSync(join(home, ".mcp.json"), "utf-8"));
    const url: string = j?.mcpServers?.claudepanion?.url ?? "";
    const m = url.match(/:(\d+)\/mcp\b/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Activates the plugin via the `claude` CLI and probes the running server, so
 * `claudepanion plugin install` can self-report whether the chain actually
 * works (settings.json alone is insufficient — Claude Code bug #32606).
 *
 * Separate from {@link runPluginInstall} (which only writes settings.json, and
 * must stay side-effect-light for its tests) so this — the part that shells out
 * and hits the network — is unit-tested only with injected fakes and never runs
 * the real `claude` CLI / `fetch` in the suite.
 */
export async function activateAndReport(opts: {
  home: string;
  runClaude?: RunClaude;
  probe?: ProbeFn;
  log?: (line: string) => void;
}): Promise<ActivateReport> {
  const activation = await activatePlugin({
    home: opts.home,
    runClaude: opts.runClaude,
    log: opts.log,
  });

  const port = parseMcpPort(opts.home);
  const probe = opts.probe ?? defaultProbe;
  let server: ServerProbe;
  if (port == null) {
    server = { port: null, reachable: false, detail: ".mcp.json missing or unparseable" };
  } else {
    const health = await probe(`http://localhost:${port}/api/health`);
    if (!health.ok) {
      server = {
        port,
        reachable: false,
        detail: `server not reachable at :${port} — run 'claudepanion serve'`,
      };
    } else {
      const mcp = await probe(`http://localhost:${port}/api/mcp/status`);
      server = { port, reachable: true, mcpOk: mcp.ok };
    }
  }

  return { activation, server };
}

export async function runPluginUninstall(opts: { scope: "global" | "repo"; userHome?: string; repoRoot?: string }): Promise<PluginInstallResult> {
  const userHome = userHomeOrDefault(opts);
  const home = claudepanionHome(userHome);
  const settingsPath = settingsPathFor(opts.scope, { scope: opts.scope, userHome: opts.userHome, repoRoot: opts.repoRoot, frameworkRoot: "" });
  if (!existsSync(settingsPath)) return { ok: true, settingsPath };
  const settings = readJson(settingsPath);
  const enabledPlugins = settings.enabledPlugins as Record<string, boolean> | undefined;
  if (enabledPlugins && enabledPlugins[PLUGIN_NAME] !== undefined) delete enabledPlugins[PLUGIN_NAME];
  const marketplaces = settings.extraKnownMarketplaces as Record<string, unknown> | undefined;
  if (marketplaces && marketplaces.local) delete marketplaces.local;
  const additionalDirectories = settings.additionalDirectories as string[] | undefined;
  if (additionalDirectories) {
    settings.additionalDirectories = additionalDirectories.filter((d) => d !== home);
  }
  writeJson(settingsPath, settings);
  return { ok: true, settingsPath };
}
