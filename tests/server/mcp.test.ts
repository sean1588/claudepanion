import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createEntityStore } from "../../src/server/entity-store";
import { createRegistry } from "../../src/server/companion-registry";
import { buildMcpServer } from "../../src/server/mcp";
import type { Manifest, CompanionToolDefinition } from "../../src/shared/types.js";
import { successResult } from "../../src/shared/types.js";

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
    const registry = createRegistry([{ manifest: manifest("x"), tools: [] }]);
    const { listToolNames } = buildMcpServer({ store, registry, companionsDir: tmp, snapshots: new Map() });
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
      { manifest: { ...manifest("t"), kind: "tool" }, tools: [] },
    ]);
    const { listToolNames } = buildMcpServer({ store, registry, companionsDir: tmp, snapshots: new Map() });
    expect(listToolNames()).not.toContain("t_get");
    expect(listToolNames()).not.toContain("t_list");
  });

  it("registers companion-declared domain tools", () => {
    const store = createEntityStore(tmp);
    const domainTool: CompanionToolDefinition<{ id: string }> = {
      name: "x_domain_op",
      description: "a domain operation",
      schema: { id: z.string() },
      async handler({ id }) {
        return successResult({ id });
      },
    };
    const registry = createRegistry([{ manifest: manifest("x"), tools: [domainTool] }]);
    const { listToolNames } = buildMcpServer({ store, registry, companionsDir: tmp, snapshots: new Map() });
    expect(listToolNames()).toContain("x_domain_op");
  });

  it("x_get invokes entity store", async () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("x"), tools: [] }]);
    await store.create({ id: "x-1", companion: "x", input: { k: 1 } });
    const { invokeTool } = buildMcpServer({ store, registry, companionsDir: tmp, snapshots: new Map() });
    const result = await invokeTool("x_get", { id: "x-1" });
    const entity = JSON.parse(result.content[0].text);
    expect(entity.id).toBe("x-1");
  });

  it("x_append_log mutates entity", async () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("x"), tools: [] }]);
    await store.create({ id: "x-1", companion: "x", input: {} });
    const { invokeTool } = buildMcpServer({ store, registry, companionsDir: tmp, snapshots: new Map() });
    await invokeTool("x_append_log", { id: "x-1", message: "hi" });
    const e = await store.get("x", "x-1");
    expect(e?.logs[0].message).toBe("hi");
  });

  it("registers build_self_check only for the build companion", () => {
    const store = createEntityStore(tmp);
    const registryWithBuild = createRegistry([{ manifest: manifest("build"), tools: [] }]);
    const built = buildMcpServer({ store, registry: registryWithBuild, companionsDir: tmp, snapshots: new Map() });
    expect(built.listToolNames()).toContain("build_self_check");

    const registryNoBuild = createRegistry([{ manifest: manifest("other"), tools: [] }]);
    const other = buildMcpServer({ store, registry: registryNoBuild, companionsDir: tmp, snapshots: new Map() });
    expect(other.listToolNames()).not.toContain("build_self_check");
    expect(other.listToolNames()).not.toContain("other_self_check");
  });

  it("build_self_check returns validator + smoke for a registered companion", async () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([
      { manifest: manifest("build"), tools: [] },
      { manifest: manifest("x"), tools: [] },
    ]);
    const snapshots = new Map();
    const { invokeTool } = buildMcpServer({ store, registry, companionsDir: tmp, snapshots });
    const result = await invokeTool("build_self_check", { companion: "x" });
    const data = JSON.parse(result.content[0].text);
    expect(data.validator).toBeDefined();
    expect(data.smoke).toBeDefined();
    expect(data.ranAt).toMatch(/^\d{4}-/);
    expect(typeof data.ok).toBe("boolean");
    expect(snapshots.has("x")).toBe(true);
  });

  it("build_self_check returns [input] error for unregistered companion", async () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("build"), tools: [] }]);
    const { invokeTool } = buildMcpServer({ store, registry, companionsDir: tmp, snapshots: new Map() });
    const result = await invokeTool("build_self_check", { companion: "nope" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/\[input\] companion not registered/);
  });
});
