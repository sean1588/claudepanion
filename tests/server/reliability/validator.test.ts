import { describe, it, expect } from "vitest";
import { validateCompanion } from "../../../src/server/reliability/validator";

const baseManifest = {
  name: "expense-tracker",
  kind: "entity" as const,
  displayName: "Expense Tracker",
  icon: "💰",
  description: "Track expenses.",
  contractVersion: "1",
  version: "0.1.0",
};

describe("validateCompanion", () => {
  it("accepts a well-formed entity manifest", () => {
    const r = validateCompanion({ manifest: baseManifest, module: { tools: { "expense-tracker_classify": async () => ({}) } }, companionDir: null });
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("flags invalid name as fatal", () => {
    const r = validateCompanion({ manifest: { ...baseManifest, name: "Bad_Name" }, module: null, companionDir: null });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "manifest.name.invalid" && i.fatal)).toBe(true);
  });

  it("flags unknown kind as fatal", () => {
    const r = validateCompanion({ manifest: { ...baseManifest, kind: "wizard" as any }, module: null, companionDir: null });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "manifest.kind.invalid" && i.fatal)).toBe(true);
  });

  it("flags unsupported contractVersion as fatal", () => {
    const r = validateCompanion({ manifest: { ...baseManifest, contractVersion: "2" }, module: null, companionDir: null });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "manifest.contractVersion.unsupported" && i.fatal)).toBe(true);
  });

  it("flags bad version as non-fatal", () => {
    const r = validateCompanion({ manifest: { ...baseManifest, version: "banana" }, module: null, companionDir: null });
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.code === "manifest.version.invalid" && !i.fatal)).toBe(true);
  });

  it("flags empty displayName as non-fatal", () => {
    const r = validateCompanion({ manifest: { ...baseManifest, displayName: "" }, module: null, companionDir: null });
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.code === "manifest.displayName.empty")).toBe(true);
  });

  it("flags mis-namespaced tools", () => {
    const r = validateCompanion({
      manifest: baseManifest,
      module: { tools: { "wrong_prefix_do": async () => ({}) } },
      companionDir: null,
    });
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.code === "tool.name.namespace")).toBe(true);
  });

  it("flags missing manifest as fatal", () => {
    const r = validateCompanion({ manifest: null, module: null, companionDir: null });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "manifest.missing")).toBe(true);
  });

  it("flags missing companion files when dir given", () => {
    const r = validateCompanion({ manifest: baseManifest, module: null, companionDir: "/tmp/nonexistent-companion-dir-xyz" });
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.code === "file.missing")).toBe(true);
  });
});
