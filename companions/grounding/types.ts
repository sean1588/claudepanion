export interface GroundingInput {
  /** Optional focus area — e.g. "plugin system", "MCP wiring". Omit for full overview. */
  focus?: string;
}

export interface GroundingArtifact {
  briefing: string; // Markdown narrative — four sections.
}
