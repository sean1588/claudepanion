import { describe, it, expect } from "vitest";
import { z } from "zod";
import { schemaToDescriptor } from "../../src/server/schema-introspect";
import { descriptorToSchema } from "../../src/client/lib/descriptor-to-schema";

describe("descriptor round-trip", () => {
  it("string + describe + meta + optional survives the round-trip", () => {
    const original = z.object({
      title: z.string().min(1).describe("Title").meta({ ui: { kind: "text" } }),
      note: z.string().optional().describe("Optional note"),
    });
    const rebuilt = descriptorToSchema(schemaToDescriptor(original));
    const result = rebuilt.safeParse({ title: "hi" });
    expect(result.success).toBe(true);
    // The describe / meta should still be readable on the rebuilt schema.
    const titleField = rebuilt.shape.title as z.ZodTypeAny;
    expect((titleField as any).meta?.().description).toBe("Title");
    expect((titleField as any).meta?.().ui).toEqual({ kind: "text" });
  });

  it("rejects missing required field after round-trip", () => {
    const original = z.object({ x: z.string().min(1) });
    const rebuilt = descriptorToSchema(schemaToDescriptor(original));
    const result = rebuilt.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts valid datetime after round-trip", () => {
    const original = z.object({ when: z.string().datetime() });
    const rebuilt = descriptorToSchema(schemaToDescriptor(original));
    const ok = rebuilt.safeParse({ when: "2026-05-10T14:30:00Z" });
    expect(ok.success).toBe(true);
    const bad = rebuilt.safeParse({ when: "2026-05-10T14:30" });
    expect(bad.success).toBe(false);
  });
});
