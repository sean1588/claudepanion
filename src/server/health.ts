import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface McpSnapshot {
  firstRequestAt: number | null;
  lastRequestAt: number | null;
}

export interface HealthInput {
  mcpSnapshot: McpSnapshot;
  detectPlugin?: () => Promise<boolean>;
}

export interface HealthResult {
  host: "running";
  pluginInstalled: boolean | null;
  mcp: { firstRequestAt: string | null; lastRequestAt: string | null };
}

export async function computeHealth({ mcpSnapshot, detectPlugin }: HealthInput): Promise<HealthResult> {
  let pluginInstalled: boolean | null;
  try {
    pluginInstalled = detectPlugin ? await detectPlugin() : await defaultDetectPlugin();
  } catch {
    pluginInstalled = null;
  }
  return {
    host: "running",
    pluginInstalled,
    mcp: {
      firstRequestAt: mcpSnapshot.firstRequestAt ? new Date(mcpSnapshot.firstRequestAt).toISOString() : null,
      lastRequestAt: mcpSnapshot.lastRequestAt ? new Date(mcpSnapshot.lastRequestAt).toISOString() : null,
    },
  };
}

async function defaultDetectPlugin(): Promise<boolean> {
  // Look in the user's home Claude settings for claudepanion in enabledPlugins.
  const settingsPath = join(homedir(), ".claude", "settings.json");
  const raw = await readFile(settingsPath, "utf-8");
  const parsed = JSON.parse(raw) as { enabledPlugins?: Record<string, unknown> };
  const enabled = parsed.enabledPlugins ?? {};
  return Object.keys(enabled).some((k) => k.toLowerCase().includes("claudepanion"));
}
