import { describe, it, expect } from "vitest";
import { z } from "zod";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateCompanion } from "../../../src/server/reliability/validator";
import type { CompanionToolDefinition } from "../../../src/shared/types";
import { successResult } from "../../../src/shared/types";

const baseManifest = {
  name: "expense-tracker",
  kind: "ui" as const,
  displayName: "Expense Tracker",
  icon: "💰",
  description: "Track expenses.",
  contractVersion: "2",
  version: "0.1.0",
};

const makeTool = (name: string): CompanionToolDefinition => ({
  name,
  description: "test tool",
  schema: { id: z.string() },
  async handler() { return successResult({ ok: true }); },
});

describe("validateCompanion", () => {
  it("accepts a well-formed entity manifest", () => {
    const r = validateCompanion({
      manifest: baseManifest,
      module: { tools: [makeTool("expense_tracker_classify")] },
      companionDir: null,
    });
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
    const r = validateCompanion({ manifest: { ...baseManifest, contractVersion: "99" }, module: null, companionDir: null });
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

  it("flags mis-namespaced tools as fatal", () => {
    const r = validateCompanion({
      manifest: baseManifest,
      module: { tools: [makeTool("wrong_prefix_do")] },
      companionDir: null,
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "tool.name.namespace" && i.fatal)).toBe(true);
  });

  it("flags missing manifest as fatal", () => {
    const r = validateCompanion({ manifest: null, module: null, companionDir: null });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "manifest.missing")).toBe(true);
  });

  it("flags missing companion files when dir given", () => {
    const r = validateCompanion({ manifest: baseManifest, module: null, companionDir: "/tmp/nonexistent-companion-dir-xyz" });
    // file.missing is non-fatal; skill.missing is gated on manifest.ts existing,
    // so it doesn't fire for a fully-synthetic dir (no manifest.ts).
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.code === "file.missing")).toBe(true);
  });

  it("accepts manifest with requiredEnv and optionalEnv when tools are present", () => {
    const r = validateCompanion({
      manifest: { ...baseManifest, requiredEnv: ["GITHUB_TOKEN"], optionalEnv: ["SLACK_TOKEN"] },
      module: { tools: [makeTool("expense_tracker_classify")] },
      companionDir: null,
    });
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.fatal)).toEqual([]);
  });

  it("flags requiredEnv with no tools as fatal (§16f.1)", () => {
    const r = validateCompanion({
      manifest: { ...baseManifest, requiredEnv: ["GITHUB_TOKEN"] },
      module: { tools: [] },
      companionDir: null,
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "tools.empty_with_requiredEnv" && i.fatal)).toBe(true);
  });

  it("accepts manifest with requiredEnv that is empty array", () => {
    const r = validateCompanion({
      manifest: { ...baseManifest, requiredEnv: [] },
      module: null,
      companionDir: null,
    });
    expect(r.ok).toBe(true);
  });

  it("flags non-array requiredEnv as non-fatal", () => {
    const r = validateCompanion({
      manifest: { ...baseManifest, requiredEnv: "GITHUB_TOKEN" as any },
      module: null,
      companionDir: null,
    });
    expect(r.issues.some((i) => i.code === "manifest.requiredEnv.invalid")).toBe(true);
  });

  it("accepts the correct camelCase export for a numeric-suffix slug (regression: github-pr-reviewer-3)", () => {
    // Bug: the validator computed the expected export with a /-([a-z])/g
    // conversion that skipped digits, so for slug `github-pr-reviewer-3` it
    // looked for `githubPrReviewer-3` and rejected the valid (codegen-emitted)
    // `githubPrReviewer3` with a fatal index.export.missing.
    const dir = mkdtempSync(join(tmpdir(), "cp-val-"));
    writeFileSync(
      join(dir, "index.ts"),
      `export const githubPrReviewer3: RegisteredCompanion = { manifest, tools };\n`,
    );
    const r = validateCompanion({
      manifest: { ...baseManifest, name: "github-pr-reviewer-3" },
      module: null,
      companionDir: dir,
    });
    expect(r.issues.some((i) => i.code === "index.export.missing")).toBe(false);
  });
});
