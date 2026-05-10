import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, lstatSync, readFileSync } from "node:fs";
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
