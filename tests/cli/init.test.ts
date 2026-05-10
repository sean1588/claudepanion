import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, lstatSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../../src/cli/init.js";

let home: string;
const frameworkRoot = join(__dirname, "../../"); // points at the repo root for tests

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "claudepanion-init-"));
});

afterEach(() => {
  try { rmSync(home, { recursive: true, force: true }); } catch {}
});

describe("runInit — fresh install", () => {
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
});

describe("runInit — idempotent", () => {
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

describe("runInit — clobber refusal", () => {
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
