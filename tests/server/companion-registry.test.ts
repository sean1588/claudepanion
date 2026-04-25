import { describe, it, expect } from "vitest";
import { createRegistry, type RegisteredCompanion } from "../../src/server/companion-registry";
import type { Manifest } from "../../src/shared/types";

const fakeManifest = (name: string): Manifest => ({
  name,
  kind: "entity",
  displayName: name,
  icon: "🧪",
  description: "test companion",
  contractVersion: "1",
  version: "0.0.1",
});

describe("companion registry", () => {
  it("lists registered companions", () => {
    const a: RegisteredCompanion = { manifest: fakeManifest("a"), tools: [] };
    const b: RegisteredCompanion = { manifest: fakeManifest("b"), tools: [] };
    const r = createRegistry([a, b]);
    expect(r.list().map((c) => c.manifest.name)).toEqual(["a", "b"]);
  });

  it("looks up by name", () => {
    const a: RegisteredCompanion = { manifest: fakeManifest("a"), tools: [] };
    const r = createRegistry([a]);
    expect(r.get("a")?.manifest.displayName).toBe("a");
    expect(r.get("missing")).toBeNull();
  });

  it("refuses unknown contractVersion", () => {
    const bad: RegisteredCompanion = {
      manifest: { ...fakeManifest("x"), contractVersion: "99" },
      tools: [],
    };
    expect(() => createRegistry([bad])).toThrow(/contractVersion/);
  });
});
