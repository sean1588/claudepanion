import { z } from "zod";
import type { EntityStore } from "./entity-store.js";
import type { Registry, RegisteredCompanion } from "./companion-registry.js";
import type { CompanionToolDefinition, McpToolResult } from "../shared/types.js";
import { successResult, errorResult } from "../shared/types.js";

export interface McpDeps {
  store: EntityStore;
  registry: Registry;
}

export interface McpHandle {
  listToolNames(): string[];
  invokeTool(name: string, args: unknown): Promise<McpToolResult>;
  /** Live map of all registered tool definitions — updated by rebuildFor. */
  toolDefs: Map<string, CompanionToolDefinition>;
  rebuildFor(companionName: string): void;
}

const STATUS_SCHEMA = z.enum(["pending", "running", "completed", "error"]);
const LOG_LEVEL_SCHEMA = z.enum(["info", "warn", "error"]);

function buildEntityTools(store: EntityStore, c: RegisteredCompanion): CompanionToolDefinition[] {
  const n = c.manifest.name;
  const label = c.manifest.displayName;
  return [
    {
      name: `${n}_get`,
      description: `Get a ${label} entity by ID. Always the first call in a skill run — loads the entity's input fields so subsequent steps know what to do.`,
      schema: {
        id: z.string().describe(`${label} entity ID (e.g. ${n}-abc123)`),
      },
      async handler(params) {
        const { id } = params as { id: string };
        const e = await store.get(n, id);
        if (!e) return errorResult(`entity not found: ${n}/${id}`);
        return successResult(e);
      },
    },
    {
      name: `${n}_list`,
      description: `List ${label} entities, optionally filtered by status.`,
      schema: {
        status: STATUS_SCHEMA.optional().describe("filter by status — omit to list all"),
      },
      async handler(params) {
        const { status } = params as { status?: string };
        const all = await store.list(n);
        return successResult(status ? all.filter((e) => e.status === status) : all);
      },
    },
    {
      name: `${n}_update_status`,
      description: `Update the status of a ${label} entity. The UI status pill re-renders within 2 seconds. Use statusMessage to show a short progress note (e.g. "querying logs").`,
      schema: {
        id: z.string().describe(`${label} entity ID`),
        status: STATUS_SCHEMA.describe("new status"),
        statusMessage: z
          .string()
          .optional()
          .describe('short note shown alongside the status pill, e.g. "querying CloudWatch"'),
      },
      async handler(params) {
        const { id, status, statusMessage } = params as { id: string; status: string; statusMessage?: string };
        await store.updateStatus(n, id, status as any, statusMessage ?? null);
        return successResult({ ok: true });
      },
    },
    {
      name: `${n}_append_log`,
      description: `Append a line to the entity's live log tail. The UI picks it up within 2 seconds. Call this after each meaningful step so the user can see progress in real time.`,
      schema: {
        id: z.string().describe(`${label} entity ID`),
        message: z.string().describe("log message to display"),
        level: LOG_LEVEL_SCHEMA.optional().describe("log level (default: info)"),
      },
      async handler(params) {
        const { id, message, level } = params as { id: string; message: string; level?: string };
        await store.appendLog(n, id, message, (level as any) ?? "info");
        return successResult({ ok: true });
      },
    },
    {
      name: `${n}_save_artifact`,
      description: `Save the completed artifact. The UI morphs from the log tail to the artifact view. The artifact shape is defined by the companion's Artifact type in companions/${n}/types.ts.`,
      schema: {
        id: z.string().describe(`${label} entity ID`),
        artifact: z.record(z.string(), z.unknown()).describe("artifact object — shape defined by the companion's Artifact type"),
      },
      async handler(params) {
        const { id, artifact } = params as { id: string; artifact: Record<string, unknown> };
        await store.saveArtifact(n, id, artifact);
        return successResult({ ok: true });
      },
    },
    {
      name: `${n}_fail`,
      description: `Mark the entity as failed. Call this on any unrecoverable error — the UI shows the error state and the user can retry.`,
      schema: {
        id: z.string().describe(`${label} entity ID`),
        errorMessage: z.string().describe("short description of what went wrong"),
        errorStack: z.string().optional().describe("stack trace or additional context"),
      },
      async handler(params) {
        const { id, errorMessage, errorStack } = params as { id: string; errorMessage: string; errorStack?: string };
        await store.fail(n, id, errorMessage, errorStack);
        return successResult({ ok: true });
      },
    },
  ];
}

function buildAllToolDefs(store: EntityStore, c: RegisteredCompanion): CompanionToolDefinition[] {
  const defs: CompanionToolDefinition[] = [];
  if (c.manifest.kind === "entity") {
    defs.push(...buildEntityTools(store, c));
  }
  defs.push(...c.tools);
  return defs;
}

export function buildMcpServer({ store, registry }: McpDeps): McpHandle {
  const toolDefs = new Map<string, CompanionToolDefinition>();

  const loadCompanion = (c: RegisteredCompanion) => {
    for (const def of buildAllToolDefs(store, c)) {
      toolDefs.set(def.name, def);
    }
  };

  for (const c of registry.list()) loadCompanion(c);

  const rebuildFor = (companionName: string) => {
    const c = registry.get(companionName);
    if (!c) return;
    for (const key of [...toolDefs.keys()]) {
      if (key === companionName || key.startsWith(`${companionName}_`)) toolDefs.delete(key);
    }
    loadCompanion(c);
  };

  registry.onChange((name) => rebuildFor(name));

  return {
    listToolNames: () => [...toolDefs.keys()].sort(),
    invokeTool: async (name, args) => {
      const def = toolDefs.get(name);
      if (!def) return errorResult(`unknown tool: ${name}`);
      return await def.handler(args as any);
    },
    toolDefs,
    rebuildFor,
  };
}
