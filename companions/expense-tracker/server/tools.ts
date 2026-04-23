// Domain tools specific to expense-tracker. Plan 1 has none — the generic
// <companion>_* plumbing is enough for Claude to read the input, classify,
// and save the artifact. Kept as an explicit empty export so the contract
// shape is uniform across companions.
import type { ToolHandler } from "../../../src/server/companion-registry";

export const tools: Record<string, ToolHandler> = {};
