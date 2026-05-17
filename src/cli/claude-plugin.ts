import { existsSync, lstatSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const PLUGIN_DESCRIPTION =
  "Localhost companion host for Claude Code — build small web apps whose backend is Claude Code over MCP.";

/**
 * Generates `~/.claudepanion/.claude-plugin/{plugin.json,marketplace.json}`.
 *
 * Generated (not symlinked) on purpose: `marketplace.json`'s `source: "./"` is
 * resolved by Claude Code relative to the plugin root, and if `.claude-plugin/`
 * were a symlink to the framework checkout, the plugin root would resolve there
 * — re-introducing the exact "only works inside the repo" bug. A real directory
 * at `~/.claudepanion/.claude-plugin/` makes the plugin root unambiguous.
 *
 * `version` comes from the framework `package.json` (single source of truth, no
 * hardcoded version to drift). Idempotent: deterministic content, rewritten in
 * place each call. A pre-existing `.claude-plugin` *symlink* (an old approach or
 * a hand-fix) is unlinked and replaced with a real directory first.
 */
export function ensureClaudePluginManifest(home: string, version: string): { path: string } {
  const dir = join(home, ".claude-plugin");

  try {
    const st = lstatSync(dir);
    if (st.isSymbolicLink()) unlinkSync(dir);
  } catch {
    // doesn't exist — fine.
  }
  mkdirSync(dir, { recursive: true });

  const plugin = {
    name: "claudepanion",
    description: PLUGIN_DESCRIPTION,
    version,
    author: { name: "claudepanion" },
    license: "Apache-2.0",
    keywords: ["mcp", "claude", "companion", "reference-architecture"],
  };
  const marketplace = {
    name: "local",
    description: "Local marketplace for claudepanion",
    owner: { name: "claudepanion" },
    plugins: [
      {
        name: "claudepanion",
        description: PLUGIN_DESCRIPTION,
        version,
        source: "./",
        author: { name: "claudepanion" },
      },
    ],
  };

  writeFileSync(join(dir, "plugin.json"), JSON.stringify(plugin, null, 2) + "\n");
  writeFileSync(join(dir, "marketplace.json"), JSON.stringify(marketplace, null, 2) + "\n");
  return { path: dir };
}

export interface ClaudeResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Injectable seam (mirrors api-routes' `deleteCompanionFiles` convention). */
export type RunClaude = (args: string[]) => Promise<ClaudeResult>;

/** Default `runClaude` — spawns the real `claude` CLI. ENOENT (not on PATH)
 *  resolves to code 127 rather than rejecting, so callers branch uniformly. */
const defaultRunClaude: RunClaude = (args) =>
  new Promise((resolve) => {
    const proc = spawn("claude", args, { shell: false });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => resolve({ code: 127, stdout, stderr: stderr || err.message }));
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });

export type ActivateResult =
  | { activated: true; ranCommands: string[] }
  | { activated: false; reason: "claude-not-found" | "command-failed"; commands: string[]; detail?: string };

const FALLBACK_COMMANDS = (home: string) => [
  `claude plugin marketplace add ${home}`,
  `claude plugin install claudepanion@local`,
];

function looksAlreadyKnown(r: ClaudeResult): boolean {
  return /already|exists|known/i.test(`${r.stdout} ${r.stderr}`);
}

/**
 * Activates the claudepanion plugin via the `claude` CLI.
 *
 * `settings.json` `extraKnownMarketplaces`+`enabledPlugins` alone does NOT
 * activate a directory-marketplace plugin (Claude Code bug #32606), so the
 * supported non-interactive path is `claude plugin marketplace add` +
 * `claude plugin install`. Marketplace re-registration uses `marketplace
 * update` (never `remove`+`add`, which uninstalls plugins). Never throws on a
 * missing `claude` — returns a structured result so the caller can print a
 * manual fallback.
 */
export async function activatePlugin(opts: {
  home: string;
  runClaude?: RunClaude;
  log?: (line: string) => void;
}): Promise<ActivateResult> {
  const run = opts.runClaude ?? defaultRunClaude;
  const home = opts.home;
  const ranCommands: string[] = [];
  const record = (args: string[]) => ranCommands.push(`claude ${args.join(" ")}`);

  // Probe: is the claude CLI available?
  const probe = await run(["--version"]);
  if (probe.code !== 0) {
    return { activated: false, reason: "claude-not-found", commands: FALLBACK_COMMANDS(home) };
  }

  // Marketplace: add; if already known, refresh via `update` (never remove).
  const addArgs = ["plugin", "marketplace", "add", home];
  const add = await run(addArgs);
  if (add.code === 0) {
    record(addArgs);
  } else if (looksAlreadyKnown(add)) {
    const updateArgs = ["plugin", "marketplace", "update", "local"];
    const update = await run(updateArgs);
    if (update.code !== 0) {
      return {
        activated: false,
        reason: "command-failed",
        commands: FALLBACK_COMMANDS(home),
        detail: `marketplace update failed: ${update.stderr || update.stdout}`.trim(),
      };
    }
    record(updateArgs);
  } else {
    return {
      activated: false,
      reason: "command-failed",
      commands: FALLBACK_COMMANDS(home),
      detail: `marketplace add failed: ${add.stderr || add.stdout}`.trim(),
    };
  }

  // Install (already-installed is success).
  const installArgs = ["plugin", "install", "claudepanion@local"];
  const install = await run(installArgs);
  if (install.code !== 0 && !looksAlreadyKnown(install)) {
    return {
      activated: false,
      reason: "command-failed",
      commands: FALLBACK_COMMANDS(home),
      detail: `plugin install failed: ${install.stderr || install.stdout}`.trim(),
    };
  }
  record(installArgs);

  return { activated: true, ranCommands };
}
