// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveServerPort } from "../../src/server/boot.js";
import { writeMcpConfig, DEFAULT_MCP_PORT } from "../../src/server/mcp-config.js";

describe("resolveServerPort", () => {
  let savedPort: string | undefined;
  beforeEach(() => { savedPort = process.env.PORT; delete process.env.PORT; });
  afterEach(() => {
    if (savedPort === undefined) delete process.env.PORT;
    else process.env.PORT = savedPort;
  });

  it("prefers an explicit option", () => {
    expect(resolveServerPort({ port: 5555 })).toBe(5555);
  });

  it("falls back to the PORT env var", () => {
    process.env.PORT = "4000";
    expect(resolveServerPort({})).toBe(4000);
  });

  it("falls back to the shared default", () => {
    expect(resolveServerPort({})).toBe(DEFAULT_MCP_PORT);
  });
});

describe("boot → writeMcpConfig seam", () => {
  let home: string;
  let savedPort: string | undefined;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "cp-bootport-"));
    savedPort = process.env.PORT;
  });
  afterEach(() => {
    try { rmSync(home, { recursive: true, force: true }); } catch {}
    if (savedPort === undefined) delete process.env.PORT;
    else process.env.PORT = savedPort;
  });

  it("a non-default PORT yields a .mcp.json with that port (no server boot)", () => {
    process.env.PORT = "4000";
    const port = resolveServerPort({});
    writeMcpConfig(home, port);
    const mcp = JSON.parse(readFileSync(join(home, ".mcp.json"), "utf-8"));
    expect(mcp.mcpServers.claudepanion.url).toBe("http://localhost:4000/mcp");
  });
});
