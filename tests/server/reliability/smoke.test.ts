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

  it("treats Zod schema rejection as ok and skips handler", async () => {
    let called = false;
    const tool: CompanionToolDefinition = {
      name: "x_required",
      description: "test",
      schema: { repo: z.string(), prNumber: z.number() }, // both required
      async handler() {
        called = true;
        // If the handler runs with empty args, this would crash in production —
        // but smoke shouldn't reach here because Zod rejects {} first.
        return successResult({ ok: true });
      },
    };
    const c: RegisteredCompanion = { manifest: baseManifest, tools: [tool] };
    const r = await smokeCompanion(c);
    expect(r.ok).toBe(true);
    expect(r.results[0].error).toBe("schema rejected empty args");
    expect(called).toBe(false);
  });

  it("does not crash on handlers that assume required fields are defined", async () => {
    // Reproduces the parseRepo(undefined) bug pattern from PR #13 dogfood:
    // a handler that destructures a required field and uses it as a string.
    // Before the Zod-first smoke fix, this crashed with TypeError. After, Zod
    // rejects {} before the handler runs.
    const tool: CompanionToolDefinition = {
      name: "x_parse",
      description: "test",
      schema: { repo: z.string() },
      async handler(params) {
        const { repo } = params as { repo: string };
        // Mimics parseRepo: assumes repo is a string. Crashes on undefined.
        repo.split("/");
        return successResult({ ok: true });
      },
    };
    const c: RegisteredCompanion = { manifest: baseManifest, tools: [tool] };
    const r = await smokeCompanion(c);
    expect(r.ok).toBe(true);
  });
});
