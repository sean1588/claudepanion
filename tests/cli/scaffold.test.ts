import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScaffold } from "../../src/cli/scaffold.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "scaffold-test-"));
  mkdirSync(join(dir, "companions/alpha"), { recursive: true });
  mkdirSync(join(dir, "companions/alpha/server"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({
    name: "test",
    type: "module",
    dependencies: {},
  }));
  writeFileSync(
    join(dir, "companions/alpha/manifest.ts"),
    `export const manifest = { name: "alpha", kind: "ui", displayName: "Alpha", icon: "🅰️", description: "test", contractVersion: "1", version: "0.1.0" };`
  );
  writeFileSync(join(dir, "companions/alpha/types.ts"), `export const InputSchema = {};`);
  writeFileSync(join(dir, "companions/alpha/server/tools.ts"), `export const tools = [];`);
  mkdirSync(join(dir, "skills/alpha-companion"), { recursive: true });
  writeFileSync(join(dir, "skills/alpha-companion/SKILL.md"), `---\nname: alpha-companion\ndescription: alpha\n---\n# alpha`);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("scaffold CLI — discovery + codegen", () => {
  it("emits companion index.ts and registry files for a fresh slug", async () => {
    const result = await runScaffold("alpha", {
      cwd: dir,
      runBuild: false,
      runRemount: false,
      runSelfCheck: false,
    });
    expect(result.ok).toBe(true);
    expect(existsSync(join(dir, "companions/alpha/index.ts"))).toBe(true);
    expect(readFileSync(join(dir, "companions/index.ts"), "utf8")).toContain("alpha");
    expect(readFileSync(join(dir, "companions/client.ts"), "utf8")).toContain("AUTO-GENERATED");
  });
});
