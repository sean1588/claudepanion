import type { EntityStore } from "./entity-store.js";
import type { Registry, RegisteredCompanion, ToolHandler } from "./companion-registry.js";

export interface McpDeps {
  store: EntityStore;
  registry: Registry;
}

export interface McpHandle {
  listToolNames(): string[];
  invokeTool(name: string, args: unknown): Promise<unknown>;
  handlers: Record<string, ToolHandler>;
  rebuildFor(companionName: string): void;
}

function buildCompanionHandlers(store: EntityStore, c: RegisteredCompanion): Record<string, ToolHandler> {
  const out: Record<string, ToolHandler> = {};
  const name = c.manifest.name;

  if (c.manifest.kind === "entity") {
    out[`${name}_get`] = async (args: any) => {
      const e = await store.get(name, args.id);
      if (!e) throw new Error(`entity not found: ${name}/${args.id}`);
      return e;
    };
    out[`${name}_list`] = async (args: any) => {
      const all = await store.list(name);
      return args?.status ? all.filter((e) => e.status === args.status) : all;
    };
    out[`${name}_update_status`] = async (args: any) => {
      await store.updateStatus(name, args.id, args.status, args.statusMessage ?? null);
      return { ok: true };
    };
    out[`${name}_append_log`] = async (args: any) => {
      await store.appendLog(name, args.id, args.message, args.level ?? "info");
      return { ok: true };
    };
    out[`${name}_save_artifact`] = async (args: any) => {
      await store.saveArtifact(name, args.id, args.artifact);
      return { ok: true };
    };
    out[`${name}_fail`] = async (args: any) => {
      await store.fail(name, args.id, args.errorMessage, args.errorStack);
      return { ok: true };
    };
  }

  for (const [toolName, fn] of Object.entries(c.tools)) {
    out[toolName] = fn;
  }
  return out;
}

export function buildMcpServer({ store, registry }: McpDeps): McpHandle {
  const handlers: Record<string, ToolHandler> = {};

  for (const c of registry.list()) {
    Object.assign(handlers, buildCompanionHandlers(store, c));
  }

  const rebuildFor = (companionName: string) => {
    const c = registry.get(companionName);
    if (!c) return;
    for (const key of Object.keys(handlers)) {
      if (key === companionName || key.startsWith(`${companionName}_`)) delete handlers[key];
    }
    Object.assign(handlers, buildCompanionHandlers(store, c));
  };

  registry.onChange((name) => rebuildFor(name));

  return {
    listToolNames: () => Object.keys(handlers).sort(),
    invokeTool: async (name, args) => {
      const fn = handlers[name];
      if (!fn) throw new Error(`unknown tool: ${name}`);
      return await fn(args);
    },
    handlers,
    rebuildFor,
  };
}
