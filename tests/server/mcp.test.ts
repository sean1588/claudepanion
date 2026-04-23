import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore } from "../../src/server/entity-store";
import { createRegistry } from "../../src/server/companion-registry";
import { buildMcpServer } from "../../src/server/mcp";
import type { Manifest } from "../../src/shared/types.js";

const manifest = (name: string): Manifest => ({
  name,
  kind: "entity",
  displayName: name,
  icon: "🧪",
  description: "t",
  contractVersion: "1",
  version: "0.0.1",
});

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "claudepanion-mcp-"));
});

describe("mcp server", () => {
  it("registers generic tools per entity companion", () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("x"), tools: {} }]);
    const { listToolNames } = buildMcpServer({ store, registry });
    const names = listToolNames();
    expect(names).toContain("x_get");
    expect(names).toContain("x_list");
    expect(names).toContain("x_update_status");
    expect(names).toContain("x_append_log");
    expect(names).toContain("x_save_artifact");
    expect(names).toContain("x_fail");
  });

  it("does not register generic tools for tool-kind companions", () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([
      { manifest: { ...manifest("t"), kind: "tool" }, tools: {} },
    ]);
    const { listToolNames } = buildMcpServer({ store, registry });
    expect(listToolNames()).not.toContain("t_get");
    expect(listToolNames()).not.toContain("t_list");
  });

  it("registers companion-declared domain tools", () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([
      {
        manifest: manifest("x"),
        tools: { x_domain_op: () => ({ ok: true }) },
      },
    ]);
    const { listToolNames } = buildMcpServer({ store, registry });
    expect(listToolNames()).toContain("x_domain_op");
  });

  it("x_get invokes entity store", async () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("x"), tools: {} }]);
    await store.create({ id: "x-1", companion: "x", input: { k: 1 } });
    const { invokeTool } = buildMcpServer({ store, registry });
    const result = await invokeTool("x_get", { id: "x-1" });
    expect((result as any).id).toBe("x-1");
  });

  it("x_append_log mutates entity", async () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("x"), tools: {} }]);
    await store.create({ id: "x-1", companion: "x", input: {} });
    const { invokeTool } = buildMcpServer({ store, registry });
    await invokeTool("x_append_log", { id: "x-1", message: "hi" });
    const e = await store.get("x", "x-1");
    expect(e?.logs[0].message).toBe("hi");
  });
});
