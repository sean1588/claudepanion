import { describe, it, expect, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRegistry } from "../../src/server/companion-registry";
import type { RegisteredCompanion } from "../../src/server/companion-registry";
import { rewriteCompanionsIndex } from "../../src/server/companions-index";

function mk(name: string, source?: "local" | "installed"): RegisteredCompanion {
  return {
    manifest: { name, kind: "entity", displayName: name, icon: "x", description: "x", contractVersion: "1", version: "0.1.0" },
    tools: {},
    source,
  };
}

let repoRoot: string;
beforeEach(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), "cp-idx-"));
  await mkdir(resolve(repoRoot, "companions"));
  await writeFile(resolve(repoRoot, "companions/index.ts"), "// placeholder\n");
});

describe("rewriteCompanionsIndex", () => {
  it("sorts companions alphabetically and emits relative imports for local source", async () => {
    const reg = createRegistry([mk("homelab"), mk("build"), mk("expense-tracker")]);
    await rewriteCompanionsIndex(repoRoot, reg);
    const out = readFileSync(resolve(repoRoot, "companions/index.ts"), "utf-8");
    expect(out).toContain(`import { build } from "./build/index.js";`);
    expect(out).toContain(`import { expenseTracker } from "./expense-tracker/index.js";`);
    expect(out).toContain(`import { homelab } from "./homelab/index.js";`);
    // alphabetical order in the export array
    expect(out).toMatch(/\[build, expenseTracker, homelab\]/);
  });

  it("emits bare imports for installed source", async () => {
    const reg = createRegistry([mk("build"), mk("oncall", "installed")]);
    await rewriteCompanionsIndex(repoRoot, reg);
    const out = readFileSync(resolve(repoRoot, "companions/index.ts"), "utf-8");
    expect(out).toContain(`import { oncall } from "claudepanion-oncall";`);
    expect(out).toContain(`import { build } from "./build/index.js";`);
  });

  it("handles hyphenated slugs with camelCase idents", async () => {
    const reg = createRegistry([mk("expense-tracker"), mk("oncall-investigator", "installed")]);
    await rewriteCompanionsIndex(repoRoot, reg);
    const out = readFileSync(resolve(repoRoot, "companions/index.ts"), "utf-8");
    expect(out).toContain(`import { expenseTracker } from "./expense-tracker/index.js";`);
    expect(out).toContain(`import { oncallInvestigator } from "claudepanion-oncall-investigator";`);
  });
});
