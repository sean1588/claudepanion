import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore } from "../../src/server/entity-store";
import { createRegistry } from "../../src/server/companion-registry";
import { buildMcpServer } from "../../src/server/mcp";
import { createMcpHttp } from "../../src/server/mcp-http";
import type { Manifest } from "../../src/shared/types.js";

const manifest = (name: string): Manifest => ({
  name,
  kind: "ui",
  displayName: name,
  icon: "🧪",
  description: "t",
  contractVersion: "2",
  version: "0.0.1",
});

const INIT_BODY = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "probe", version: "0" },
  },
};

let tmp: string;
let app: express.Express;
let http: ReturnType<typeof createMcpHttp>;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "claudepanion-mcphttp-"));
  const store = createEntityStore(tmp);
  const registry = createRegistry([{ manifest: manifest("widget"), tools: [] }]);
  const mcp = buildMcpServer({ store, registry, companionsDir: tmp, snapshots: new Map() });
  app = express();
  app.use(express.json());
  http = createMcpHttp(mcp, registry);
  http.mount(app, "/mcp");
});

afterEach(async () => {
  await http.closeAll();
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
});

function initialize() {
  return request(app)
    .post("/mcp")
    .set("accept", "application/json, text/event-stream")
    .set("content-type", "application/json")
    .send(INIT_BODY);
}

describe("createMcpHttp — multi-session", () => {
  it("accepts two independent initialize requests with distinct session ids (regression: 'Server already initialized')", async () => {
    const r1 = await initialize();
    expect(r1.status).toBe(200);
    const sid1 = r1.headers["mcp-session-id"];
    expect(sid1).toBeTruthy();

    const r2 = await initialize();
    expect(r2.status).toBe(200);
    const sid2 = r2.headers["mcp-session-id"];
    expect(sid2).toBeTruthy();

    expect(sid2).not.toBe(sid1);
    expect(JSON.stringify(r1.body) + JSON.stringify(r2.body)).not.toMatch(/already initialized/i);
  });

  it("routes a session-scoped tools/list to a working server", async () => {
    const r1 = await initialize();
    const sid = r1.headers["mcp-session-id"];

    await request(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .set("content-type", "application/json")
      .set("mcp-session-id", sid)
      .send({ jsonrpc: "2.0", method: "notifications/initialized" });

    const list = await request(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .set("content-type", "application/json")
      .set("mcp-session-id", sid)
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

    expect(list.status).toBe(200);
    const names = (list.body?.result?.tools ?? []).map((t: { name: string }) => t.name);
    expect(names).toContain("widget_get");
  });

  it("rejects a non-initialize POST with no session id", async () => {
    const res = await request(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .set("content-type", "application/json")
      .send({ jsonrpc: "2.0", id: 9, method: "tools/list", params: {} });
    expect(res.status).toBe(400);
  });

  it("rejects a GET with no session id", async () => {
    const res = await request(app).get("/mcp").set("accept", "text/event-stream");
    expect(res.status).toBe(400);
  });

  it("closeAll() tears down active sessions", async () => {
    const r = await initialize();
    expect(r.headers["mcp-session-id"]).toBeTruthy();
    await http.closeAll();
    // A request against the now-closed session id is no longer routable.
    const after = await request(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .set("content-type", "application/json")
      .set("mcp-session-id", r.headers["mcp-session-id"])
      .send({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    expect(after.status).toBeGreaterThanOrEqual(400);
  });
});
