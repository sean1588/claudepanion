import { describe, it, expect } from "vitest";
import { z } from "zod";
import { schemaToDescriptor } from "../../src/server/schema-introspect";

describe("schemaToDescriptor", () => {
  it("returns supported: false for non-object schemas", () => {
    const d = schemaToDescriptor(z.string());
    expect(d.supported).toBe(false);
    expect(d.fields).toEqual([]);
  });

  it("handles basic string / number / boolean fields", () => {
    const schema = z.object({
      title: z.string().describe("Title"),
      count: z.number().describe("Count"),
      enabled: z.boolean().describe("Enabled"),
    });
    const d = schemaToDescriptor(schema);
    expect(d.supported).toBe(true);
    expect(d.fields.map((f) => ({ name: f.name, type: f.type, optional: f.optional }))).toEqual([
      { name: "title", type: "string", optional: false },
      { name: "count", type: "number", optional: false },
      { name: "enabled", type: "boolean", optional: false },
    ]);
  });

  it("marks optional and default-valued fields as optional", () => {
    const schema = z.object({
      a: z.string().optional(),
      b: z.string().default("hi"),
    });
    const d = schemaToDescriptor(schema);
    expect(d.fields.find((f) => f.name === "a")?.optional).toBe(true);
    expect(d.fields.find((f) => f.name === "b")?.optional).toBe(true);
  });

  it("captures z.string().datetime() validator", () => {
    const schema = z.object({ when: z.string().datetime() });
    const d = schemaToDescriptor(schema);
    expect(d.fields[0].validators?.datetime).toBe(true);
  });

  it("captures string min/max length validators", () => {
    const schema = z.object({ s: z.string().min(2).max(10) });
    const d = schemaToDescriptor(schema);
    expect(d.fields[0].validators?.minLength).toBe(2);
    expect(d.fields[0].validators?.maxLength).toBe(10);
  });

  it("captures number min/max value validators", () => {
    const schema = z.object({ n: z.number().min(0).max(100) });
    const d = schemaToDescriptor(schema);
    expect(d.fields[0].validators?.min).toBe(0);
    expect(d.fields[0].validators?.max).toBe(100);
  });

  it("captures meta.ui hints", () => {
    const schema = z.object({
      env: z.string().meta({ ui: { kind: "select", options: ["dev", "prod"] } }).describe("Env"),
      thing: z.string().meta({ ui: { kind: "select", optionsFrom: "list_things", argsFrom: ["env"] } }).describe("Thing"),
    });
    const d = schemaToDescriptor(schema);
    expect(d.fields[0].ui).toEqual({ kind: "select", options: ["dev", "prod"] });
    expect(d.fields[1].ui).toEqual({ kind: "select", optionsFrom: "list_things", argsFrom: ["env"] });
  });

  it("captures description text", () => {
    const schema = z.object({ x: z.string().describe("Hello") });
    expect(schemaToDescriptor(schema).fields[0].description).toBe("Hello");
  });

  it("skips unsupported field types (e.g. enums, arrays)", () => {
    const schema = z.object({
      ok: z.string(),
      tags: z.array(z.string()),                    // unsupported
      colors: z.enum(["red", "green"]),             // unsupported (not ZodString/Number/Boolean)
    });
    const d = schemaToDescriptor(schema);
    expect(d.fields.map((f) => f.name)).toEqual(["ok"]);
  });
});
