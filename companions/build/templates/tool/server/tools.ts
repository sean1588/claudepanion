import type { ToolHandler } from "../../../src/server/companion-registry.js";
import { defineTool } from "../../../src/server/tool-meta.js";

// Domain tools for __NAME__. Each must be namespaced "__NAME___<verb>".
// Use defineTool(handler, { description, params }) to surface metadata
// on the auto-generated About page.
export const tools: Record<string, ToolHandler> = {
  __NAME___ping: defineTool(
    async () => ({ pong: true }),
    { description: "Liveness check — returns { pong: true }.", params: [] }
  ),
};
