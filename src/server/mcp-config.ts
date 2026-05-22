import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Default server port. `init` writes this into `.mcp.json`; `serve` corrects
 *  it to the effective port. Shared so the two can't disagree. */
export const DEFAULT_MCP_PORT = 3001;

/**
 * Writes `~/.claudepanion/.mcp.json` — the plugin-root MCP config Claude Code
 * loads (in any cwd) once the claudepanion plugin is installed.
 *
 * Single source of truth for the file's shape. Both `init` (default port 3001)
 * and `boot` (the actually-bound port) call this, so the two can never disagree
 * about the URL. Idempotent: the file is rewritten only when its content would
 * change, so calling it on every `serve` is cheap and touch-free.
 *
 * A concrete port is baked in, not `${...}` interpolation — Claude Code's
 * environment at session start has no `PORT`, which is why `init` writes 3001
 * and `serve` corrects it.
 */
export function writeMcpConfig(home: string, port: number): { written: boolean; path: string } {
  const path = join(home, ".mcp.json");
  const desired =
    JSON.stringify(
      {
        mcpServers: {
          claudepanion: { type: "http", url: `http://localhost:${port}/mcp` },
        },
      },
      null,
      2,
    ) + "\n";

  const existing = existsSync(path) ? readFileSync(path, "utf-8") : null;
  if (existing === desired) return { written: false, path };

  writeFileSync(path, desired);
  return { written: true, path };
}
