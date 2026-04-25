import { describe, it, expect } from "vitest";
import { z } from "zod";
import { smokeCompanion } from "../../../src/server/reliability/smoke";
import type { RegisteredCompanion } from "../../../src/server/companion-registry";
import type { CompanionToolDefinition } from "../../../src/shared/types";
import { successResult } from "../../../src/shared/types";

const baseManifest = {
  name: "x",
  kind: "entity" as const,
  displayName: "X",
  icon: "x",
  description: "x",
  contractVersion: "1",
  version: "0.1.0",
};

const makeTool = (name: string, handler: CompanionToolDefinition["handler"]): CompanionToolDefinition => ({
  name,
  description: "test",
  schema: { id: z.string().optional() },
  handler,
});

describe("smokeCompanion", () => {
  it("passes when all tools resolve", async () => {
    const c: RegisteredCompanion = {
      manifest: baseManifest,
      tools: [
        makeTool("x_one", async () => successResult({ ok: true })),
        makeTool("x_two", async () => successResult(1)),
      ],
    };
    const r = await smokeCompanion(c);
    expect(r.ok).toBe(true);
    expect(r.results).toHaveLength(2);
    expect(r.results.every((x) => x.ok)).toBe(true);
  });

  it("passes when tools throw validation-shaped errors", async () => {
    const c: RegisteredCompanion = {
      manifest: baseManifest,
      tools: [
        makeTool("x_one", async () => { throw new Error("id required"); }),
      ],
    };
    const r = await smokeCompanion(c);
    expect(r.ok).toBe(true);
    expect(r.results[0].error).toBe("id required");
  });

  it("fails on TypeError (code-level bug)", async () => {
    const c: RegisteredCompanion = {
      manifest: baseManifest,
      tools: [
        makeTool("x_one", async () => { throw new TypeError("cannot read property 'foo' of undefined"); }),
      ],
    };
    const r = await smokeCompanion(c);
    expect(r.ok).toBe(false);
    expect(r.results[0].error).toContain("TypeError");
  });

  it("passes empty report when companion has no tools", async () => {
    const c: RegisteredCompanion = { manifest: baseManifest, tools: [] };
    const r = await smokeCompanion(c);
    expect(r).toEqual({ ok: true, results: [] });
  });
});
