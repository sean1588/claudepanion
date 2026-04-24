#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const pkgRoot = resolve(dirname(__filename), "..");

const USAGE = `claudepanion — localhost companion host for Claude Code

Usage:
  claudepanion serve                 start the server (default port 3001)
  claudepanion plugin install        register claudepanion as a Claude Code plugin in this repo
  claudepanion plugin uninstall      unregister the plugin from this repo
  claudepanion --help                show this help

Options:
  PORT=<n>                           override server port (serve only)

Notes:
  - "plugin install" writes to <repo>/.claude/settings.local.json so Claude Code
    loads both the MCP tools AND the bundled skills at session start. It does NOT
    modify .mcp.json. Run this in every repo where you want claudepanion available.
  - "serve" runs the HTTP server the plugin's MCP entry points at. Run it in a
    long-lived terminal; plugin install only configures Claude Code, not the server.
`;

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function findGitRoot() {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return dir;
    dir = dirname(dir);
  }
  return null;
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf-8")); }
  catch { return null; }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function pluginInstall() {
  const gitRoot = findGitRoot();
  if (!gitRoot) die("Error: not inside a git repository");

  const settingsPath = join(gitRoot, ".claude", "settings.local.json");
  const settings = readJson(settingsPath) ?? {};

  settings.enabledPlugins ??= {};
  settings.enabledPlugins["claudepanion@local"] = true;

  settings.extraKnownMarketplaces ??= {};
  settings.extraKnownMarketplaces.local = {
    source: { source: "directory", path: pkgRoot },
  };

  // Pre-disable the cwd .mcp.json entry so it doesn't double-register with the
  // plugin's own .mcp.json once the plugin is enabled. Harmless if the cwd
  // doesn't actually have a claudepanion entry.
  if (!Array.isArray(settings.disabledMcpjsonServers)) settings.disabledMcpjsonServers = [];
  if (!settings.disabledMcpjsonServers.includes("claudepanion")) {
    settings.disabledMcpjsonServers.push("claudepanion");
  }

  writeJson(settingsPath, settings);
  console.log("✓  Plugin installed in Claude Code");
  console.log(`   Plugin directory: ${pkgRoot}`);
  console.log(`   Settings: ${settingsPath}`);
  console.log("\n   Start a new Claude Code session for the plugin to load.");
}

function pluginUninstall() {
  const gitRoot = findGitRoot();
  if (!gitRoot) die("Error: not inside a git repository");

  const settingsPath = join(gitRoot, ".claude", "settings.local.json");
  const settings = readJson(settingsPath);
  if (!settings) { console.log("Nothing to uninstall."); return; }

  if (settings.enabledPlugins) delete settings.enabledPlugins["claudepanion@local"];
  if (settings.extraKnownMarketplaces) delete settings.extraKnownMarketplaces.local;
  if (Array.isArray(settings.disabledMcpjsonServers)) {
    settings.disabledMcpjsonServers = settings.disabledMcpjsonServers.filter((s) => s !== "claudepanion");
    if (settings.disabledMcpjsonServers.length === 0) delete settings.disabledMcpjsonServers;
  }

  writeJson(settingsPath, settings);
  console.log(`✓  Plugin removed from Claude Code (${settingsPath})`);
}

function serve() {
  const entry = join(pkgRoot, "dist/src/server/index.js");
  if (!existsSync(entry)) {
    die(
      `Build not found at ${entry}.\n` +
      `Run \`npm run build\` in the claudepanion repo first, or reinstall.`
    );
  }
  const proc = spawn(process.execPath, [entry], {
    stdio: "inherit",
    cwd: pkgRoot,
    env: process.env,
  });
  proc.on("exit", (code) => process.exit(code ?? 0));
}

const [cmd, sub] = process.argv.slice(2);

if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
  console.log(USAGE);
  process.exit(cmd ? 0 : 1);
} else if (cmd === "serve") {
  serve();
} else if (cmd === "plugin" && sub === "install") {
  pluginInstall();
} else if (cmd === "plugin" && sub === "uninstall") {
  pluginUninstall();
} else {
  die(`unknown command: ${[cmd, sub].filter(Boolean).join(" ")}\n\n${USAGE}`);
}
