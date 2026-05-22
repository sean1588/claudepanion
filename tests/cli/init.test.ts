// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, lstatSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runInit } from "../../src/cli/init.js";

let home: string;
const frameworkRoot = join(__dirname, "../../"); // points at the repo root for tests

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "claudepanion-init-"));
});

afterEach(() => {
  try { rmSync(home, { recursive: true, force: true }); } catch {}
});

// Each test spawns a real `tsc` compile (runInit); under full-suite parallel
// CPU contention that exceeds vitest's 5s default. Mirror the explicit
// long-timeout convention used by end-to-end.test.ts.
describe("runInit — fresh install", { timeout: 60_000 }, () => {
  it("creates package.json with name 'claudepanion-home'", async () => {
    const result = await runInit({ home, frameworkRoot });
    expect(result.ok).toBe(true);
    const pkg = JSON.parse(readFileSync(join(home, "package.json"), "utf-8"));
    expect(pkg.name).toBe("claudepanion-home");
    expect(pkg.dependencies).toEqual({});
  });

  it("creates .gitignore with sensible defaults", async () => {
    await runInit({ home, frameworkRoot });
    const gi = readFileSync(join(home, ".gitignore"), "utf-8");
    expect(gi).toContain("node_modules/");
    expect(gi).toContain("data/");
    expect(gi).toContain("cache/");
    expect(gi).toContain("dist/");
  });

  it("creates tsconfig.json extending the framework's tsconfig.base.json via node_modules", async () => {
    await runInit({ home, frameworkRoot });
    const ts = JSON.parse(readFileSync(join(home, "tsconfig.json"), "utf-8"));
    // Direct path via node_modules — bypasses npm `exports` resolution which
    // older tsc versions don't honor for `extends` subpaths.
    expect(ts.extends).toBe("./node_modules/claudepanion-host/src/host/tsconfig.base.json");
    expect(ts.compilerOptions.outDir).toBe("dist");
    expect(ts.include).toContain("companions/**/*.ts");
  });

  it("creates data/, cache/, dist/ as real dirs", async () => {
    await runInit({ home, frameworkRoot });
    for (const sub of ["data", "cache", "dist"]) {
      expect(existsSync(join(home, sub))).toBe(true);
      expect(lstatSync(join(home, sub)).isDirectory()).toBe(true);
    }
  });

  it("creates companions/build, skills/build-companion, node_modules/claudepanion-host as symlinks", async () => {
    await runInit({ home, frameworkRoot });
    for (const sub of ["companions/build", "skills/build-companion", "node_modules/claudepanion-host"]) {
      const p = join(home, sub);
      expect(existsSync(p)).toBe(true);
      expect(lstatSync(p).isSymbolicLink()).toBe(true);
    }
  });

  it("after init, dist/companions/index.js exists and exports an array with build", async () => {
    await runInit({ home, frameworkRoot });
    const distIndex = join(home, "dist/companions/index.js");
    expect(existsSync(distIndex)).toBe(true);
    // Load it and verify Build is registered.
    // Use pathToFileURL so Vitest's module resolver doesn't intercept the import.
    const mod = await import(pathToFileURL(distIndex).href);
    expect(Array.isArray(mod.companions)).toBe(true);
    expect(mod.companions.map((c: any) => c.manifest.name)).toContain("build");
  });
});

describe("runInit — plugin plumbing", { timeout: 60_000 }, () => {
  it("generates .claude-plugin/ + .mcp.json so the plugin works in any cwd", async () => {
    const result = await runInit({ home, frameworkRoot });
    expect(result.ok).toBe(true);

    const fwVersion = JSON.parse(
      readFileSync(join(frameworkRoot, "package.json"), "utf-8"),
    ).version;

    // .claude-plugin/ is a REAL dir (not a symlink) so marketplace.json's
    // source:"./" resolves to ~/.claudepanion, not the framework checkout.
    const cpDir = join(home, ".claude-plugin");
    expect(lstatSync(cpDir).isDirectory()).toBe(true);
    expect(lstatSync(cpDir).isSymbolicLink()).toBe(false);

    const plugin = JSON.parse(readFileSync(join(cpDir, "plugin.json"), "utf-8"));
    expect(plugin.name).toBe("claudepanion");
    expect(plugin.version).toBe(fwVersion);

    const mkt = JSON.parse(readFileSync(join(cpDir, "marketplace.json"), "utf-8"));
    expect(mkt.name).toBe("local");
    expect(mkt.plugins[0].version).toBe(fwVersion);
    expect(mkt.plugins[0].source).toBe("./");

    const mcp = JSON.parse(readFileSync(join(home, ".mcp.json"), "utf-8"));
    expect(mcp.mcpServers.claudepanion.type).toBe("http");
    expect(mcp.mcpServers.claudepanion.url).toBe("http://localhost:3001/mcp");

    if (result.ok) {
      expect(result.filesCreated).toEqual(
        expect.arrayContaining([
          ".claude-plugin/plugin.json",
          ".claude-plugin/marketplace.json",
          ".mcp.json",
        ]),
      );
    }
  });
});

describe("runInit — idempotent", { timeout: 60_000 }, () => {
  it("running twice does not error and refreshes symlinks", async () => {
    await runInit({ home, frameworkRoot });
    const result2 = await runInit({ home, frameworkRoot });
    expect(result2.ok).toBe(true);
    expect(existsSync(join(home, "companions/build"))).toBe(true);
    expect(lstatSync(join(home, "companions/build")).isSymbolicLink()).toBe(true);
  });

  it("preserves user content during refresh", async () => {
    await runInit({ home, frameworkRoot });
    // Simulate a user-authored companion.
    const userDir = join(home, "companions/my-companion");
    mkdirSync(userDir, { recursive: true });
    writeFileSync(join(userDir, "manifest.ts"), "// user-authored");
    // Re-init.
    await runInit({ home, frameworkRoot });
    expect(existsSync(join(userDir, "manifest.ts"))).toBe(true);
    expect(readFileSync(join(userDir, "manifest.ts"), "utf-8")).toBe("// user-authored");
  });
});

describe("runInit — clobber refusal", { timeout: 60_000 }, () => {
  it("returns error if existing package.json has a non-claudepanion-home name", async () => {
    const result = await runInit({ home, frameworkRoot });
    expect(result.ok).toBe(true);
    // Corrupt the existing package.json so it looks like a non-claudepanion dir.
    writeFileSync(join(home, "package.json"), JSON.stringify({ name: "my-other-thing" }, null, 2));
    const result2 = await runInit({ home, frameworkRoot });
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.stage).toBe("validate");
      expect(result2.error).toMatch(/not a claudepanion home/i);
    }
  });

  it("--force overrides clobber refusal", async () => {
    await runInit({ home, frameworkRoot });
    writeFileSync(join(home, "package.json"), JSON.stringify({ name: "my-other-thing" }, null, 2));
    const result = await runInit({ home, frameworkRoot, force: true });
    expect(result.ok).toBe(true);
    const pkg = JSON.parse(readFileSync(join(home, "package.json"), "utf-8"));
    expect(pkg.name).toBe("claudepanion-home");
  });
});
