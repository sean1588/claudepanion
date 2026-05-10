import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPluginInstall, runPluginUninstall } from "../../src/cli/plugin-install";

let userHome: string;       // simulates $HOME
let repoRoot: string;       // simulates a git repo with a .git/

beforeEach(() => {
  userHome = mkdtempSync(join(tmpdir(), "cp-plugin-home-"));
  repoRoot = mkdtempSync(join(tmpdir(), "cp-plugin-repo-"));
  mkdirSync(join(repoRoot, ".git"));
  // Pretend ~/.claudepanion/ exists (precondition).
  mkdirSync(join(userHome, ".claudepanion"));
});

afterEach(() => {
  rmSync(userHome, { recursive: true, force: true });
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("plugin install — global default", () => {
  it("writes to ~/.claude/settings.json (global)", async () => {
    const result = await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    expect(result.ok).toBe(true);
    const settingsPath = join(userHome, ".claude/settings.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.enabledPlugins["claudepanion@local"]).toBe(true);
    expect(settings.extraKnownMarketplaces.local.source.path).toBe(join(userHome, ".claudepanion"));
  });

  it("refuses when ~/.claudepanion/ does not exist", async () => {
    rmSync(join(userHome, ".claudepanion"), { recursive: true, force: true });
    const result = await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/init/i);
  });
});

describe("plugin install — --repo", () => {
  it("writes to <repo>/.claude/settings.local.json", async () => {
    const result = await runPluginInstall({ scope: "repo", userHome, frameworkRoot: "/fake/framework", repoRoot });
    expect(result.ok).toBe(true);
    const settingsPath = join(repoRoot, ".claude/settings.local.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.enabledPlugins["claudepanion@local"]).toBe(true);
    expect(settings.extraKnownMarketplaces.local.source.path).toBe(join(userHome, ".claudepanion"));
  });
});

describe("plugin uninstall mirrors --repo", () => {
  it("global uninstall removes ~/.claude/settings.json entries", async () => {
    await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    const result = await runPluginUninstall({ scope: "global", userHome });
    expect(result.ok).toBe(true);
    const settings = JSON.parse(readFileSync(join(userHome, ".claude/settings.json"), "utf-8"));
    expect(settings.enabledPlugins?.["claudepanion@local"]).toBeUndefined();
  });
});
