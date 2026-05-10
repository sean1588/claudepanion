/**
 * Tracks whether an MCP client has ever talked to this server process.
 *
 * Bumped from the /mcp HTTP route on every incoming request — including the
 * initial `initialize` handshake — so `firstRequestAt` flips from null to a
 * timestamp the moment any MCP client connects, well before any tool call.
 *
 * The UI uses `firstRequestAt === null` as the authoritative "MCP has never
 * connected" signal, replacing the earlier age-of-pending-entity heuristic.
 */
export interface McpStatus {
  firstRequestAt: number | null;
  lastRequestAt: number | null;
}

const state: McpStatus = { firstRequestAt: null, lastRequestAt: null };

export function bumpMcpStatus(now: number = Date.now()): void {
  if (state.firstRequestAt === null) state.firstRequestAt = now;
  state.lastRequestAt = now;
}

export function getMcpStatus(): McpStatus {
  return { firstRequestAt: state.firstRequestAt, lastRequestAt: state.lastRequestAt };
}

/** Test-only: clears observed state so each test starts fresh. */
export function resetMcpStatus(): void {
  state.firstRequestAt = null;
  state.lastRequestAt = null;
}
