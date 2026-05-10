import { z } from "zod";
import type { CompanionToolDefinition, McpToolResult } from "./types.js";

export function defineTool<S extends z.ZodRawShape>(def: {
  name: string;
  description: string;
  schema: S;
  sideEffect?: "read" | "write";
  handler: (params: z.infer<z.ZodObject<S>>) => Promise<McpToolResult>;
}): CompanionToolDefinition {
  return {
    name: def.name,
    description: def.description,
    schema: def.schema,
    sideEffect: def.sideEffect,
    handler: def.handler as CompanionToolDefinition["handler"],
  };
}
