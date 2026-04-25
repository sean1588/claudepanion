import { z } from "zod";
import type { CompanionToolDefinition } from "../../../src/shared/types.js";
import { successResult } from "../../../src/shared/types.js";

// MCP tools for __NAME__ (kind: "tool").
// These are exposed directly as slash-command-callable MCP tools — no entity lifecycle.
// Each tool name must be prefixed "__NAME___".

export const tools: CompanionToolDefinition[] = [
  {
    name: "__NAME___ping",
    description: "Liveness check — returns { pong: true }.",
    schema: {},
    async handler() {
      return successResult({ pong: true });
    },
  },
];
