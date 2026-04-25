import { z } from "zod";

export type EntityStatus = "pending" | "running" | "completed" | "error";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface Entity<Input = unknown, Artifact = unknown> {
  id: string;
  companion: string;
  status: EntityStatus;
  statusMessage: string | null;
  createdAt: string;
  updatedAt: string;
  input: Input;
  artifact: Artifact | null;
  errorMessage: string | null;
  errorStack: string | null;
  logs: LogEntry[];
}

export type CompanionKind = "entity" | "tool";

export interface Manifest {
  name: string;
  kind: CompanionKind;
  displayName: string;
  icon: string;
  description: string;
  contractVersion: string;
  version: string;
}

// ─── MCP tool contract ───────────────────────────────────────────────────────

/** The wire return type every tool handler must produce. */
export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
}

export function successResult(data: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(message: string): McpToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * The single interface every companion tool must satisfy — both the generic
 * entity tools auto-registered by the host and the domain proxy tools defined
 * in companions/<name>/server/tools.ts.
 *
 * @example
 * const myTool: CompanionToolDefinition<{ id: string; query: string }> = {
 *   name: "mycompanion_fetch",
 *   description: "Fetch data from the external service for this entity.",
 *   schema: {
 *     id: z.string().describe("entity ID"),
 *     query: z.string().describe("query string"),
 *   },
 *   async handler({ id, query }) {
 *     const data = await myApiClient.fetch(query);
 *     return successResult(data);
 *   },
 * };
 */
export interface CompanionToolDefinition<
  TParams extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  description: string;
  /** Zod raw shape — passed to z.object() for MCP schema registration. */
  schema: z.ZodRawShape;
  handler: (params: TParams) => Promise<McpToolResult>;
}
