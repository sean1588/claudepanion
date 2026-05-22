// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  lstatSync,
  readFileSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureClaudePluginManifest, activatePlugin } from "../../src/cli/claude-plugin.js";

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "cp-claudeplugin-"));
});
afterEach(() => {
  try { rmSync(home, { recursive: true, force: true }); } catch {}
});

describe("ensureClaudePluginManifest", () => {
  it("generates parseable plugin.json + marketplace.json with the given version", () => {
    const r = ensureClaudePluginManifest(home, "0.3.0");
    expect(r.path).toBe(join(home, ".claude-plugin"));
    const plugin = JSON.parse(readFileSync(join(home, ".claude-plugin/plugin.json"), "utf-8"));
    const mkt = JSON.parse(readFileSync(join(home, ".claude-plugin/marketplace.json"), "utf-8"));
    expect(plugin.name).toBe("claudepanion");
    expect(plugin.version).toBe("0.3.0");
    expect(mkt.name).toBe("local");
    expect(mkt.plugins[0].name).toBe("claudepanion");
    expect(mkt.plugins[0].version).toBe("0.3.0");
    expect(mkt.plugins[0].source).toBe("./");
  });

  it("is idempotent — re-running keeps valid manifests", () => {
    ensureClaudePluginManifest(home, "0.3.0");
    expect(() => ensureClaudePluginManifest(home, "0.3.0")).not.toThrow();
    const plugin = JSON.parse(readFileSync(join(home, ".claude-plugin/plugin.json"), "utf-8"));
    expect(plugin.version).toBe("0.3.0");
  });

  it("replaces a pre-existing .claude-plugin symlink with a real directory", () => {
    const otherDir = mkdtempSync(join(tmpdir(), "cp-other-"));
    mkdirSync(join(otherDir, "x"));
    symlinkSync(otherDir, join(home, ".claude-plugin"));
    expect(lstatSync(join(home, ".claude-plugin")).isSymbolicLink()).toBe(true);

    ensureClaudePluginManifest(home, "0.3.0");

    expect(lstatSync(join(home, ".claude-plugin")).isSymbolicLink()).toBe(false);
    expect(lstatSync(join(home, ".claude-plugin")).isDirectory()).toBe(true);
    expect(existsSync(join(home, ".claude-plugin/plugin.json"))).toBe(true);
    // the symlink target is untouched
    expect(existsSync(join(otherDir, "x"))).toBe(true);
    rmSync(otherDir, { recursive: true, force: true });
  });
});

/** Scripts runClaude responses keyed by the first two args (e.g. "plugin marketplace"). */
function fakeRunClaude(script: (args: string[]) => { code: number; stdout?: string; stderr?: string }) {
  const calls: string[][] = [];
  const fn = async (args: string[]) => {
    calls.push(args);
    const r = script(args);
    return { code: r.code, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  };
  return Object.assign(fn, { calls });
}

describe("activatePlugin", () => {
  it("activates: marketplace add + install when claude is present and clean", async () => {
    const run = fakeRunClaude((args) => {
      if (args[0] === "--version") return { code: 0, stdout: "2.1.143" };
      return { code: 0 };
    });
    const r = await activatePlugin({ home, runClaude: run });
    expect(r.activated).toBe(true);
    if (r.activated) {
      expect(r.ranCommands.some((c) => c.includes("marketplace add"))).toBe(true);
      expect(r.ranCommands.some((c) => c.includes("install claudepanion@local"))).toBe(true);
    }
  });

  it("returns claude-not-found (no throw) when the claude CLI is absent", async () => {
    const run = fakeRunClaude((args) => {
      if (args[0] === "--version") return { code: 127, stderr: "command not found" };
      return { code: 0 };
    });
    const r = await activatePlugin({ home, runClaude: run });
    expect(r.activated).toBe(false);
    if (!r.activated) {
      expect(r.reason).toBe("claude-not-found");
      expect(r.commands.length).toBeGreaterThan(0);
    }
  });

  it("treats an already-known marketplace as success and runs marketplace update", async () => {
    const run = fakeRunClaude((args) => {
      if (args[0] === "--version") return { code: 0, stdout: "2.1.143" };
      if (args.join(" ") === `plugin marketplace add ${home}`)
        return { code: 1, stderr: "marketplace 'local' already exists" };
      return { code: 0 };
    });
    const r = await activatePlugin({ home, runClaude: run });
    expect(r.activated).toBe(true);
    expect(run.calls.some((c) => c.join(" ") === "plugin marketplace update local")).toBe(true);
  });

  it("returns command-failed when marketplace add fails for a non-already reason", async () => {
    const run = fakeRunClaude((args) => {
      if (args[0] === "--version") return { code: 0, stdout: "2.1.143" };
      if (args[1] === "marketplace") return { code: 1, stderr: "permission denied" };
      return { code: 0 };
    });
    const r = await activatePlugin({ home, runClaude: run });
    expect(r.activated).toBe(false);
    if (!r.activated) expect(r.reason).toBe("command-failed");
  });
});
