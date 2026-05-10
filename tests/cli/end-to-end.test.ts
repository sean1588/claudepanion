import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = join(__dirname, "../..");

describe("CLI end-to-end (init → regenerate)", () => {
  let home: string;
  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), "cp-e2e-"));
  });
  afterAll(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("init produces a valid user-local layout", () => {
    const result = spawnSync("node", [join(repoRoot, "bin/cli.js"), "init"], {
      env: { ...process.env, CLAUDEPANION_HOME_OVERRIDE: home },
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
    expect(existsSync(join(home, ".claudepanion/package.json"))).toBe(true);
    expect(existsSync(join(home, ".claudepanion/companions/build"))).toBe(true);
    expect(existsSync(join(home, ".claudepanion/dist/companions/index.js"))).toBe(true);
  });

  it("regenerate rewrites the registry idempotently after init", () => {
    const result = spawnSync("node", [join(repoRoot, "bin/cli.js"), "regenerate"], {
      env: { ...process.env, CLAUDEPANION_HOME_OVERRIDE: home },
      encoding: "utf-8",
    });
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
  });
});
