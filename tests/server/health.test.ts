import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeHealth } from "../../src/server/health";

describe("computeHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T10:00:00Z"));
  });

  it("reports host running, mcp from snapshot, plugin from detector", async () => {
    const result = await computeHealth({
      mcpSnapshot: { firstRequestAt: 1, lastRequestAt: 2 },
      detectPlugin: async () => true,
    });
    expect(result.host).toBe("running");
    expect(result.pluginInstalled).toBe(true);
    expect(result.mcp.firstRequestAt).toBe("1970-01-01T00:00:00.001Z");
  });

  it("returns pluginInstalled: null when detector throws", async () => {
    const result = await computeHealth({
      mcpSnapshot: { firstRequestAt: null, lastRequestAt: null },
      detectPlugin: async () => { throw new Error("ENOENT"); },
    });
    expect(result.pluginInstalled).toBeNull();
    expect(result.mcp.firstRequestAt).toBeNull();
  });

  it("returns pluginInstalled: false when detector returns false", async () => {
    const result = await computeHealth({
      mcpSnapshot: { firstRequestAt: null, lastRequestAt: null },
      detectPlugin: async () => false,
    });
    expect(result.pluginInstalled).toBe(false);
  });
});
