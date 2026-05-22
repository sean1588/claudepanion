import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPluginInstall, runPluginUninstall, activateAndReport } from "../../src/cli/plugin-install";

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
    // additionalDirectories grants Claude Code access to ~/.claudepanion/ from any workspace.
    expect(settings.additionalDirectories).toContain(join(userHome, ".claudepanion"));
  });

  it("does not duplicate ~/.claudepanion in additionalDirectories on re-install", async () => {
    await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    const settings = JSON.parse(readFileSync(join(userHome, ".claude/settings.json"), "utf-8"));
    const home = join(userHome, ".claudepanion");
    expect(settings.additionalDirectories.filter((d: string) => d === home).length).toBe(1);
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

describe("activateAndReport", () => {
  let home: string;
  beforeEach(() => { home = join(userHome, ".claudepanion"); });

  const allOk = async (args: string[]) =>
    args[0] === "--version"
      ? { code: 0, stdout: "2.1.143", stderr: "" }
      : { code: 0, stdout: "", stderr: "" };

  const writeMcp = (port: number) =>
    writeFileSync(
      join(home, ".mcp.json"),
      JSON.stringify({ mcpServers: { claudepanion: { type: "http", url: `http://localhost:${port}/mcp` } } }),
    );

  it("activates and reports a reachable server", async () => {
    writeMcp(3001);
    const r = await activateAndReport({
      home,
      runClaude: allOk,
      probe: async () => ({ ok: true, status: 200 }),
    });
    expect(r.activation.activated).toBe(true);
    expect(r.server.port).toBe(3001);
    expect(r.server.reachable).toBe(true);
    expect(r.server.mcpOk).toBe(true);
  });

  it("reports claude-not-found without throwing, still probes the server", async () => {
    writeMcp(3001);
    const r = await activateAndReport({
      home,
      runClaude: async (args) =>
        args[0] === "--version" ? { code: 127, stdout: "", stderr: "not found" } : { code: 0, stdout: "", stderr: "" },
      probe: async () => ({ ok: true }),
    });
    expect(r.activation.activated).toBe(false);
    if (!r.activation.activated) expect(r.activation.reason).toBe("claude-not-found");
    expect(r.server.reachable).toBe(true);
  });

  it("reports an unreachable server with serve guidance", async () => {
    writeMcp(3001);
    const r = await activateAndReport({
      home,
      runClaude: allOk,
      probe: async () => ({ ok: false }),
    });
    expect(r.server.reachable).toBe(false);
    expect(r.server.detail).toMatch(/claudepanion serve/);
  });

  it("handles a missing .mcp.json (port null, not reachable)", async () => {
    const r = await activateAndReport({
      home,
      runClaude: allOk,
      probe: async () => ({ ok: true }),
    });
    expect(r.server.port).toBeNull();
    expect(r.server.reachable).toBe(false);
  });
});

describe("plugin uninstall mirrors --repo", () => {
  it("global uninstall removes ~/.claude/settings.json entries", async () => {
    await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    const result = await runPluginUninstall({ scope: "global", userHome });
    expect(result.ok).toBe(true);
    const settings = JSON.parse(readFileSync(join(userHome, ".claude/settings.json"), "utf-8"));
    expect(settings.enabledPlugins?.["claudepanion@local"]).toBeUndefined();
    expect(settings.extraKnownMarketplaces?.local).toBeUndefined();
    expect(settings.additionalDirectories ?? []).not.toContain(join(userHome, ".claudepanion"));
  });
});
