import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataPath, cachePath, ensureClaudepanionDirs } from "../../src/server/paths.js";

let fakeHome: string;

beforeEach(() => {
  fakeHome = mkdtempSync(join(tmpdir(), "cp-test-"));
  vi.stubEnv("CLAUDEPANION_HOME_OVERRIDE", fakeHome);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(fakeHome, { recursive: true, force: true });
});

describe("paths", () => {
  it("dataPath() resolves to ~/.claudepanion/data/", () => {
    expect(dataPath()).toBe(join(fakeHome, ".claudepanion", "data"));
  });
  it("cachePath() resolves to ~/.claudepanion/cache/", () => {
    expect(cachePath()).toBe(join(fakeHome, ".claudepanion", "cache"));
  });
  it("ensureClaudepanionDirs() creates both directories", () => {
    ensureClaudepanionDirs();
    expect(existsSync(dataPath())).toBe(true);
    expect(existsSync(cachePath())).toBe(true);
  });
});
