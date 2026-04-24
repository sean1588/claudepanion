#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const pkgRoot = resolve(dirname(__filename), "..");

const USAGE = `claudepanion — localhost companion host for Claude Code

Usage:
  claudepanion serve                 start the server (default port 3001)
  claudepanion plugin install        add claudepanion MCP config to CWD's .mcp.json
  claudepanion plugin uninstall      remove claudepanion from CWD's .mcp.json
  claudepanion --help                show this help

Options:
  PORT=<n>                           override server port (serve only)
`;

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf-8")); }
  catch { return null; }
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function mcpEntry() {
  // Canonical entry the CLI installs into a target repo's .mcp.json.
  return { type: "http", url: `http://localhost:${process.env.PORT ?? 3001}/mcp` };
}

function pluginInstall() {
  const target = resolve(process.cwd(), ".mcp.json");
  const existing = readJson(target) ?? { mcpServers: {} };
  if (!existing.mcpServers || typeof existing.mcpServers !== "object") existing.mcpServers = {};
  const before = JSON.stringify(existing.mcpServers.claudepanion);
  existing.mcpServers.claudepanion = mcpEntry();
  const after = JSON.stringify(existing.mcpServers.claudepanion);
  writeJson(target, existing);
  if (before === after) console.log(`claudepanion already present in ${target}`);
  else if (before === undefined) console.log(`added claudepanion to ${target}`);
  else console.log(`updated claudepanion entry in ${target}`);
}

function pluginUninstall() {
  const target = resolve(process.cwd(), ".mcp.json");
  const existing = readJson(target);
  if (!existing || !existing.mcpServers?.claudepanion) {
    console.log(`no claudepanion entry found in ${target}`);
    return;
  }
  delete existing.mcpServers.claudepanion;
  if (Object.keys(existing.mcpServers).length === 0 && Object.keys(existing).length === 1) {
    unlinkSync(target);
    console.log(`removed claudepanion and deleted empty ${target}`);
  } else {
    writeJson(target, existing);
    console.log(`removed claudepanion from ${target}`);
  }
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
