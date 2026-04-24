import { describe, it, expect, beforeEach } from "vitest";
import { createWatcher, refreshReliability } from "../../../src/server/reliability/watcher";
import { createRegistry } from "../../../src/server/companion-registry";
import type { RegisteredCompanion } from "../../../src/server/companion-registry";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";

function mkCompanion(name: string, version: string): RegisteredCompanion {
  return {
    manifest: {
      name,
      kind: "entity",
      displayName: name,
      icon: "x",
      description: "x",
      contractVersion: "1",
      version,
    },
    tools: {},
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
      tools: {},
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
