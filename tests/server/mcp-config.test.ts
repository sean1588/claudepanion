// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeMcpConfig } from "../../src/server/mcp-config.js";

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "cp-mcpcfg-"));
});
afterEach(() => {
  try { rmSync(home, { recursive: true, force: true }); } catch {}
});

describe("writeMcpConfig", () => {
  it("creates .mcp.json with the canonical http shape for the given port", () => {
    const r = writeMcpConfig(home, 3001);
    expect(r.written).toBe(true);
    expect(r.path).toBe(join(home, ".mcp.json"));
    expect(existsSync(r.path)).toBe(true);
    const json = JSON.parse(readFileSync(r.path, "utf-8"));
    expect(json.mcpServers.claudepanion.type).toBe("http");
    expect(json.mcpServers.claudepanion.url).toBe("http://localhost:3001/mcp");
  });

  it("is idempotent — second call with the same port does not rewrite", () => {
    writeMcpConfig(home, 3001);
    const before = readFileSync(join(home, ".mcp.json"), "utf-8");
    const r = writeMcpConfig(home, 3001);
    expect(r.written).toBe(false);
    expect(readFileSync(join(home, ".mcp.json"), "utf-8")).toBe(before);
  });

  it("rewrites when the port changes", () => {
    writeMcpConfig(home, 3001);
    const r = writeMcpConfig(home, 4000);
    expect(r.written).toBe(true);
    const json = JSON.parse(readFileSync(join(home, ".mcp.json"), "utf-8"));
    expect(json.mcpServers.claudepanion.url).toBe("http://localhost:4000/mcp");
  });

  it("creates the file when absent without throwing", () => {
    expect(existsSync(join(home, ".mcp.json"))).toBe(false);
    expect(() => writeMcpConfig(home, 3001)).not.toThrow();
    expect(existsSync(join(home, ".mcp.json"))).toBe(true);
  });
});
