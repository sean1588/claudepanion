#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const pkgRoot = resolve(dirname(__filename), "..");

const USAGE = `claudepanion — localhost companion host for Claude Code

Usage:
  claudepanion init [--force]            initialize ~/.claudepanion/ (idempotent)
  claudepanion serve                     start the server (auto-initializes if needed)
  claudepanion plugin install [--repo] [--yes]
                                         register as a Claude Code plugin
  claudepanion plugin uninstall [--repo] unregister the plugin
  claudepanion companion delete <slug>   delete a scaffolded companion
  claudepanion scaffold <slug>           generate registry files, build, remount
  claudepanion regenerate                re-derive registry files from companions/
  claudepanion remount <slug>            ask the running server to re-import a companion
  claudepanion --help                    show this help

Options:
  PORT=<n>                               override server port (serve only)

Notes:
  - "init" bootstraps ~/.claudepanion/ — a user-local directory holding your
    companions, skills, and runtime data. Idempotent; safe to re-run.
  - "plugin install" defaults to global (~/.claude/settings.json). --repo writes
    per-repo settings instead.
  - "serve" auto-initializes ~/.claudepanion/ on first run if missing.
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

async function pluginInstall() {
  const wantRepo = process.argv.includes("--repo");
  const skipConfirm = process.argv.includes("--yes") || process.argv.includes("-y") || !process.stdin.isTTY;
  const { runPluginInstall } = await import(join(pkgRoot, "dist/src/cli/plugin-install.js"));
  const { homedir } = await import("node:os");
  const home = join(process.env.HOME ?? homedir(), ".claudepanion");

  let opts;
  let settingsPathPreview;
  if (wantRepo) {
    const gitRoot = findGitRoot();
    if (!gitRoot) die("Error: --repo requires a git repository");
    opts = { scope: "repo", repoRoot: gitRoot, frameworkRoot: pkgRoot };
    settingsPathPreview = join(gitRoot, ".claude/settings.local.json");
  } else {
    opts = { scope: "global", frameworkRoot: pkgRoot };
    settingsPathPreview = join(process.env.HOME ?? homedir(), ".claude/settings.json");
  }

  // Show the user exactly what we're about to modify before doing it.
  console.log(`About to register claudepanion with Claude Code:`);
  console.log(`  Settings file: ${settingsPathPreview} (${opts.scope})`);
  console.log(`  Changes:`);
  console.log(`    • enabledPlugins["claudepanion@local"] = true`);
  console.log(`    • extraKnownMarketplaces.local → directory marketplace at ${home}`);
  console.log(`    • additionalDirectories += "${home}"`);
  console.log(`        (grants Claude Code read/write access to the user-local install`);
  console.log(`         from any workspace, so /build-companion can author files there)`);

  if (!skipConfirm) {
    const answer = await prompt(`\nProceed? [Y/n] `);
    if (answer.trim().toLowerCase() === "n") {
      die("Aborted. Nothing was modified.");
    }
  }

  const result = await runPluginInstall(opts);
  if (!result.ok) die(`✗ ${result.error}`);
  console.log(`\n✓  Plugin installed (${result.settingsPath})`);
  console.log("   Start a new Claude Code session for the plugin to load.");
}

async function pluginUninstall() {
  const wantRepo = process.argv.includes("--repo");
  const { runPluginUninstall } = await import(join(pkgRoot, "dist/src/cli/plugin-install.js"));
  let opts;
  if (wantRepo) {
    const gitRoot = findGitRoot();
    if (!gitRoot) die("Error: --repo requires a git repository");
    opts = { scope: "repo", repoRoot: gitRoot };
  } else {
    opts = { scope: "global" };
  }
  const result = await runPluginUninstall(opts);
  if (!result.ok) die(`✗ ${result.error}`);
  console.log(`✓  Plugin removed (${result.settingsPath})`);
}

async function companionDelete(slug) {
  if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
    die(`invalid slug: ${JSON.stringify(slug)}\nSlug must match ^[a-z][a-z0-9-]*$`);
  }
  if (slug === "build") die("cannot delete the built-in Build companion");

  const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
  const home = rootPath();
  const companionDir = join(home, "companions", slug);
  const skillDir = join(home, "skills", `${slug}-companion`);

  if (!existsSync(companionDir)) die(`companion not found: companions/${slug}/`);

  // 1. Remove companion directory
  rmSync(companionDir, { recursive: true, force: true });
  console.log(`removed companions/${slug}/`);

  // 2. Remove skill directory if present
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    console.log(`removed skills/${slug}-companion/`);
  }

  // 3. Remove the compiled output. The server boots from dist/companions/, so
  //    leaving this behind resurrects the companion on the next restart.
  const distCompanionDir = join(home, "dist", "companions", slug);
  if (existsSync(distCompanionDir)) {
    rmSync(distCompanionDir, { recursive: true, force: true });
    console.log(`removed dist/companions/${slug}/`);
  }

  // 4. Regenerate the registry from disk state. runRegenerate rewrites both
  //    the TS source index and the compiled dist/companions/index.js, so the
  //    boot loader stays coherent without a tsc pass (npm-install users have
  //    no build step).
  try {
    const { runRegenerate } = await import(join(pkgRoot, "dist/src/cli/regenerate.js"));
    const result = await runRegenerate({ cwd: home });
    if (!result.ok) die(`failed to regenerate registry: ${result.error}`);
    console.log(`updated ${result.filesGenerated.join(", ")}`);
  } catch (err) {
    die(`failed to regenerate registry: ${err?.message ?? err}`);
  }

  // 5. Remove leftover data directory (optional — silently skip if absent)
  const dataDir = join(home, "data", slug);
  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
    console.log(`removed data/${slug}/ (entity history)`);
  }

  console.log(`\n✓  Companion "${slug}" deleted.`);
}

async function serve() {
  const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
  const home = rootPath();

  if (!existsSync(join(home, "package.json"))) {
    console.log(`~/.claudepanion/ not found.`);
    // Interactive prompt unless --yes or non-TTY.
    if (process.stdin.isTTY && !process.argv.includes("--yes")) {
      const answer = await prompt(`Initialize a new claudepanion home? [Y/n] `);
      if (answer.trim().toLowerCase() === "n") {
        die("Aborted. Run 'claudepanion init' when ready.");
      }
    }
    const { runInit } = await import(join(pkgRoot, "dist/src/cli/init.js"));
    const result = await runInit({ home, frameworkRoot: pkgRoot });
    if (!result.ok) die(`init failed at ${result.stage}: ${result.error}`);
    console.log(`✓ ~/.claudepanion/ initialized`);
  }

  const entry = join(pkgRoot, "dist/src/server/index.js");
  if (!existsSync(entry)) {
    die(`Framework build not found at ${entry}.\nReinstall: npm install -g claudepanion`);
  }
  const proc = spawn(process.execPath, [entry], {
    stdio: "inherit",
    cwd: home,
    env: process.env,
  });
  proc.on("exit", (code) => process.exit(code ?? 0));
}

async function prompt(q) {
  process.stdout.write(q);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.resume();
    stdin.once("data", (d) => { stdin.pause(); resolve(d.toString()); });
  });
}

const [cmd, sub] = process.argv.slice(2);

if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
  console.log(USAGE);
  process.exit(cmd ? 0 : 1);
} else if (cmd === "init") {
  const force = process.argv.includes("--force");
  (async () => {
    const { runInit } = await import(join(pkgRoot, "dist/src/cli/init.js"));
    const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
    const home = rootPath();
    const result = await runInit({ home, frameworkRoot: pkgRoot, force });
    if (!result.ok) {
      console.error(`✗ init failed at ${result.stage}: ${result.error}`);
      process.exit(1);
    }
    console.log(`✓ ~/.claudepanion/ initialized`);
    for (const file of result.filesCreated) console.log(`  created  ${file}`);
    for (const link of result.symlinks) console.log(`  linked   ${link.path.replace(home + "/", "")} → ${link.target}`);
    console.log(`\nTip: run 'claudepanion plugin install' to expose this to Claude Code.`);
  })();
} else if (cmd === "scaffold") {
  const slug = process.argv[3];
  if (!slug) die("Usage: claudepanion scaffold <slug>");
  (async () => {
    const { runScaffold } = await import(join(pkgRoot, "dist/src/cli/scaffold.js"));
    const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
    const result = await runScaffold(slug, { cwd: rootPath() });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })();
} else if (cmd === "regenerate") {
  (async () => {
    const { runRegenerate } = await import(join(pkgRoot, "dist/src/cli/regenerate.js"));
    const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
    const result = await runRegenerate({ cwd: rootPath() });
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
  serve().catch((err) => die(err?.message ?? String(err)));
} else if (cmd === "plugin" && sub === "install") {
  pluginInstall().catch((err) => die(err?.message ?? String(err)));
} else if (cmd === "plugin" && sub === "uninstall") {
  pluginUninstall().catch((err) => die(err?.message ?? String(err)));
} else if (cmd === "companion" && sub === "delete") {
  const slug = process.argv[4];
  if (!slug) die(`usage: claudepanion companion delete <slug>\n\n${USAGE}`);
  await companionDelete(slug);
} else {
  die(`unknown command: ${[cmd, sub].filter(Boolean).join(" ")}\n\n${USAGE}`);
}
