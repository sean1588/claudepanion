import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegenerate } from "../../src/cli/regenerate.js";

let home: string;

function addCompanionSource(slug: string) {
  const dir = join(home, "companions", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.ts"), `export const manifest = { name: "${slug}" };`);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "claudepanion-regen-"));
  mkdirSync(join(home, "companions"), { recursive: true });
});

afterEach(() => {
  try { rmSync(home, { recursive: true, force: true }); } catch {}
});

describe("runRegenerate dist coherence", () => {
  it("rewrites dist/companions/index.js to match the source when dist exists", async () => {
    addCompanionSource("alpha");
    addCompanionSource("zebra");
    // Simulate a prior build: dist/companions exists but its index.js is stale
    // (still references a since-deleted companion).
    mkdirSync(join(home, "dist", "companions"), { recursive: true });
    writeFileSync(
      join(home, "dist", "companions", "index.js"),
      `import { ghost } from "./ghost/index.js";\nexport const companions = [ghost];\n`
    );

    const res = await runRegenerate({ cwd: home });
    expect(res.ok).toBe(true);

    const distIndex = readFileSync(join(home, "dist", "companions", "index.js"), "utf8");
    expect(distIndex).toContain('import { alpha } from "./alpha/index.js";');
    expect(distIndex).toContain('import { zebra } from "./zebra/index.js";');
    expect(distIndex).toContain("export const companions = [alpha, zebra];");
    // The stale reference is gone — boot can't resurrect it.
    expect(distIndex).not.toContain("ghost");
    expect(distIndex).not.toContain("import type");
  });

  it("does not create dist/companions/index.js when no build has happened (no dist dir)", async () => {
    addCompanionSource("alpha");
    const res = await runRegenerate({ cwd: home });
    expect(res.ok).toBe(true);
    expect(existsSync(join(home, "dist", "companions", "index.js"))).toBe(false);
    // Source is still regenerated.
    expect(readFileSync(join(home, "companions", "index.ts"), "utf8")).toContain("alpha");
  });

  it("reports the dist file in filesGenerated when it writes it", async () => {
    addCompanionSource("alpha");
    mkdirSync(join(home, "dist", "companions"), { recursive: true });
    const res = await runRegenerate({ cwd: home });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.filesGenerated).toContain("dist/companions/index.js");
    }
  });
});
