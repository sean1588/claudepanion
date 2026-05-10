import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

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

  writeJson(settingsPath, settings);
  return { ok: true, settingsPath };
}

export async function runPluginUninstall(opts: { scope: "global" | "repo"; userHome?: string; repoRoot?: string }): Promise<PluginInstallResult> {
  const settingsPath = settingsPathFor(opts.scope, { scope: opts.scope, userHome: opts.userHome, repoRoot: opts.repoRoot, frameworkRoot: "" });
  if (!existsSync(settingsPath)) return { ok: true, settingsPath };
  const settings = readJson(settingsPath);
  const enabledPlugins = settings.enabledPlugins as Record<string, boolean> | undefined;
  if (enabledPlugins && enabledPlugins[PLUGIN_NAME] !== undefined) delete enabledPlugins[PLUGIN_NAME];
  const marketplaces = settings.extraKnownMarketplaces as Record<string, unknown> | undefined;
  if (marketplaces && marketplaces.local) delete marketplaces.local;
  writeJson(settingsPath, settings);
  return { ok: true, settingsPath };
}
