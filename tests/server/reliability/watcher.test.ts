import { describe, it, expect, beforeEach } from "vitest";
import { createWatcher, refreshReliability, isDistStale, DistStaleError } from "../../../src/server/reliability/watcher";
import { createRegistry } from "../../../src/server/companion-registry";
import type { RegisteredCompanion } from "../../../src/server/companion-registry";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";

function mkCompanion(name: string, version: string): RegisteredCompanion {
  return {
    manifest: {
      name,
      kind: "entity",
      displayName: name,
      icon: "x",
      description: "x",
      contractVersion: "2",
      version,
    },
    tools: [],
  };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "claudepanion-watcher-"));
});

describe("watcher.triggerRemount", () => {
  it("swaps companion in registry when reimport succeeds", async () => {
    const reg = createRegistry([mkCompanion("foo", "0.1.0")]);
    const fresh = mkCompanion("foo", "0.2.0");
    const w = createWatcher({
      registry: reg,
      companionsDir: dir,
      reimport: async () => fresh,
      logger: { info: () => {}, warn: () => {} },
    });
    await w.triggerRemount("foo");
    expect(reg.get("foo")?.manifest.version).toBe("0.2.0");
    await w.close();
  });

  it("keeps old companion when reimport fails", async () => {
    const reg = createRegistry([mkCompanion("foo", "0.1.0")]);
    const w = createWatcher({
      registry: reg,
      companionsDir: dir,
      reimport: async () => null,
      logger: { info: () => {}, warn: () => {} },
    });
    await w.triggerRemount("foo");
    expect(reg.get("foo")?.manifest.version).toBe("0.1.0");
    await w.close();
  });

  it("keeps old companion when validation fails fatally", async () => {
    const reg = createRegistry([mkCompanion("foo", "0.1.0")]);
    const bad: RegisteredCompanion = {
      manifest: { ...mkCompanion("foo", "0.2.0").manifest, contractVersion: "99" as any },
      tools: [],
    };
    const w = createWatcher({
      registry: reg,
      companionsDir: dir,
      reimport: async () => bad,
      logger: { info: () => {}, warn: () => {} },
    });
    await w.triggerRemount("foo");
    expect(reg.get("foo")?.manifest.version).toBe("0.1.0");
    await w.close();
  });

  it("updates reliability snapshot for successful remount", async () => {
    const reg = createRegistry([mkCompanion("foo", "0.1.0")]);
    const fresh = mkCompanion("foo", "0.2.0");
    const snapshots = new Map();
    const w = createWatcher({
      registry: reg,
      companionsDir: dir,
      reimport: async () => fresh,
      logger: { info: () => {}, warn: () => {} },
      snapshots,
    });
    await w.triggerRemount("foo");
    const snap = snapshots.get("foo");
    expect(snap).toBeDefined();
    expect(snap.validator.ok).toBe(true);
    expect(snap.smoke.ok).toBe(true);
    expect(snap.ranAt).toMatch(/^\d{4}-/);
    await w.close();
  });
});

describe("refreshReliability", () => {
  it("returns validator + smoke + ranAt", async () => {
    const c = mkCompanion("foo", "0.1.0");
    const r = await refreshReliability(c, null);
    expect(r.validator.ok).toBe(true);
    expect(r.smoke.ok).toBe(true);
    expect(typeof r.ranAt).toBe("string");
  });
});

describe("registry onChange", () => {
  it("fires on remount", () => {
    const reg = createRegistry([mkCompanion("foo", "0.1.0")]);
    const fired: string[] = [];
    reg.onChange((n) => fired.push(n));
    reg.remount(mkCompanion("foo", "0.2.0"));
    expect(fired).toEqual(["foo"]);
  });
});

describe("watcher dist-mtime gate", () => {
  it("isDistStale returns true when dist is older than source", () => {
    const testDir = mkdtempSync(join(tmpdir(), "watcher-stale-test-"));
    const sourcePath = join(testDir, "src.ts");
    const distPath = join(testDir, "dist.js");
    writeFileSync(sourcePath, "");
    writeFileSync(distPath, "");
    const old = new Date(Date.now() - 60000);
    utimesSync(distPath, old, old);

    expect(isDistStale(sourcePath, distPath)).toBe(true);

    rmSync(testDir, { recursive: true });
  });

  it("isDistStale returns false when dist is newer than source", () => {
    const testDir = mkdtempSync(join(tmpdir(), "watcher-stale-test-"));
    const sourcePath = join(testDir, "src.ts");
    const distPath = join(testDir, "dist.js");
    writeFileSync(sourcePath, "");
    writeFileSync(distPath, "");
    const old = new Date(Date.now() - 60000);
    utimesSync(sourcePath, old, old);

    expect(isDistStale(sourcePath, distPath)).toBe(false);

    rmSync(testDir, { recursive: true });
  });

  it("isDistStale returns true when files are missing", () => {
    expect(isDistStale("/nonexistent/source", "/nonexistent/dist")).toBe(true);
  });
});

describe("watcher retry-on-stale", () => {
  it("schedules retry when dist is stale, succeeds when dist catches up", async () => {
    let staleCount = 0;
    const fakeReimport = async (): Promise<RegisteredCompanion | null> => {
      staleCount++;
      if (staleCount < 3) throw new DistStaleError("src", "dist");
      return mkCompanion("x", "0.1.0");
    };
    const registry = createRegistry([mkCompanion("x", "0.0.1")]);
    const w = createWatcher({
      registry,
      companionsDir: dir,
      debounceMs: 10,
      reimport: fakeReimport,
      retryDelaysMs: [10, 20, 40],
      logger: { info: () => {}, warn: () => {} },
    });

    await w.triggerRemount("x");
    // Wait for retry chain to complete (10ms + 20ms + buffer)
    await new Promise((r) => setTimeout(r, 200));
    expect(staleCount).toBeGreaterThanOrEqual(3);
    expect(registry.get("x")?.manifest.version).toBe("0.1.0");
    await w.close();
  });

  it("gives up after max retries and keeps old companion", async () => {
    const registry = createRegistry([mkCompanion("y", "0.0.1")]);
    const w = createWatcher({
      registry,
      companionsDir: dir,
      debounceMs: 10,
      reimport: async () => { throw new DistStaleError("src", "dist"); },
      retryDelaysMs: [10, 20, 40],
      logger: { info: () => {}, warn: () => {} },
    });

    await w.triggerRemount("y");
    // Wait for all retries to exhaust (10 + 20 + 40 + buffer)
    await new Promise((r) => setTimeout(r, 300));
    expect(registry.get("y")?.manifest.version).toBe("0.0.1");
    await w.close();
  });
});
