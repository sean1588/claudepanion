import { describe, it, expect } from "vitest";
import { defineTool, getToolMeta, signatureString } from "../../src/server/tool-meta";

describe("defineTool / getToolMeta", () => {
  it("attaches metadata and preserves callability", async () => {
    const tool = defineTool(async (args: any) => args.x * 2, {
      description: "doubles x",
      params: [{ name: "x", type: "number", required: true }],
    });
    expect(await tool({ x: 3 })).toBe(6);
    expect(getToolMeta(tool)?.description).toBe("doubles x");
    expect(getToolMeta(tool)?.params?.[0]).toEqual({ name: "x", type: "number", required: true });
  });

  it("returns null for un-annotated handlers", () => {
    const plain = async () => 1;
    expect(getToolMeta(plain)).toBeNull();
  });
});

describe("signatureString", () => {
  it("handles no params", () => {
    expect(signatureString("homelab_status", { params: [] })).toBe("homelab_status()");
    expect(signatureString("homelab_status", null)).toBe("homelab_status()");
  });

  it("renders mixed params", () => {
    const sig = signatureString("homelab_lights_on", {
      params: [{ name: "room", type: "string", required: true }, { name: "dim", type: "number" }],
    });
    expect(sig).toBe('homelab_lights_on(room: string, dim?: number)');
  });

  it("renders enum params as string unions", () => {
    const sig = signatureString("doorbell_set_mode", {
      params: [{ name: "mode", type: "enum", enum: ["home", "away"], required: true }],
    });
    expect(sig).toBe('doorbell_set_mode(mode: "home" | "away")');
  });
});
