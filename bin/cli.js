#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const pkgRoot = resolve(dirname(__filename), "..");

const USAGE = `claudepanion — localhost companion host for Claude Code

Usage:
  claudepanion serve                     start the server (default port 3001)
  claudepanion plugin install            register claudepanion as a Claude Code plugin in this repo
  claudepanion plugin uninstall          unregister the plugin from this repo
  claudepanion companion delete <slug>   delete a scaffolded companion and clean up registrations
  claudepanion scaffold <slug>           generate registry files, build, remount, self-check
  claudepanion regenerate                re-derive registry files from companions/ on disk
  claudepanion remount <slug>            ask the running server to re-import a companion
  claudepanion --help                    show this help

Options:
  PORT=<n>                               override server port (serve only)

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

  // Cleanup stale disabled entry from older CLI versions. If you are enabling
  // the plugin, its MCP server should not also be in the disable list.
  if (Array.isArray(settings.disabledMcpjsonServers)) {
    const filtered = settings.disabledMcpjsonServers.filter((s) => s !== "claudepanion");
    if (filtered.length !== settings.disabledMcpjsonServers.length) {
      if (filtered.length === 0) delete settings.disabledMcpjsonServers;
      else settings.disabledMcpjsonServers = filtered;
    }
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

  writeJson(settingsPath, settings);
  console.log(`✓  Plugin removed from Claude Code (${settingsPath})`);
}

async function companionDelete(slug) {
  if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
    die(`invalid slug: ${JSON.stringify(slug)}\nSlug must match ^[a-z][a-z0-9-]*$`);
  }
  if (slug === "build") die("cannot delete the built-in Build companion");

  const companionDir = join(pkgRoot, "companions", slug);
  const skillDir = join(pkgRoot, "skills", `${slug}-companion`);

  if (!existsSync(companionDir)) die(`companion not found: companions/${slug}/`);

  // 1. Remove companion directory
  rmSync(companionDir, { recursive: true, force: true });
  console.log(`removed companions/${slug}/`);

  // 2. Remove skill directory if present
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    console.log(`removed skills/${slug}-companion/`);
  }

  // 3. Regenerate companions/index.ts and companions/client.ts from disk state.
  //    This is more robust than regex surgery — the regenerator reads the
  //    on-disk truth and emits whatever the codegen says is correct, so any
  //    new exports (inputSchemas, future maps) are handled automatically.
  try {
    const { runRegenerate } = await import(join(pkgRoot, "dist/src/cli/regenerate.js"));
    const result = await runRegenerate({ cwd: pkgRoot });
    if (!result.ok) die(`failed to regenerate registry: ${result.error}`);
    console.log(`updated ${result.filesGenerated.join(", ")}`);
  } catch (err) {
    die(`failed to regenerate registry: ${err?.message ?? err}\n(if dist/ is missing, run 'npm run build' once and retry)`);
  }

  // 4. Remove leftover data directory (optional — silently skip if absent)
  const dataDir = join(pkgRoot, "data", slug);
  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
    console.log(`removed data/${slug}/ (entity history)`);
  }

  console.log(`\n✓  Companion "${slug}" deleted. Rebuild the app or restart the server for changes to take effect.`);
  console.log(`   npm run build && PORT=3001 npm start`);
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
} else if (cmd === "scaffold") {
  const slug = process.argv[3];
  if (!slug) die("Usage: claudepanion scaffold <slug>");
  (async () => {
    const { runScaffold } = await import(join(pkgRoot, "dist/src/cli/scaffold.js"));
    const result = await runScaffold(slug);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })();
} else if (cmd === "regenerate") {
  (async () => {
    const { runRegenerate } = await import(join(pkgRoot, "dist/src/cli/regenerate.js"));
    const result = await runRegenerate();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })();
} else if (cmd === "remount") {
  const slug = process.argv[3];
  if (!slug) die("Usage: claudepanion remount <slug>");
  (async () => {
    const { callRemount } = await import(join(pkgRoot, "dist/src/cli/remount.js"));
    const result = await callRemount(slug);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })();
} else if (cmd === "serve") {
  serve();
} else if (cmd === "plugin" && sub === "install") {
  pluginInstall();
} else if (cmd === "plugin" && sub === "uninstall") {
  pluginUninstall();
} else if (cmd === "companion" && sub === "delete") {
  const slug = process.argv[4];
  if (!slug) die(`usage: claudepanion companion delete <slug>\n\n${USAGE}`);
  await companionDelete(slug);
} else {
  die(`unknown command: ${[cmd, sub].filter(Boolean).join(" ")}\n\n${USAGE}`);
}
