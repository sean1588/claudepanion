import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore } from "../../src/server/entity-store";
import { createRegistry } from "../../src/server/companion-registry";
import { mountApiRoutes } from "../../src/server/api-routes";
import type { Manifest } from "@shared/types";

const manifest = (name: string): Manifest => ({
  name,
  kind: "entity",
  displayName: name,
  icon: "🧪",
  description: "t",
  contractVersion: "1",
  version: "0.0.1",
});

let app: express.Express;
let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "claudepanion-api-"));
  const store = createEntityStore(tmp);
  const registry = createRegistry([{ manifest: manifest("x"), tools: [] }]);
  app = express();
  app.use(express.json());
  mountApiRoutes(app, { store, registry });
});

afterEach(() => {
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
});

describe("api routes", () => {
  it("GET /api/companions returns manifests", async () => {
    const res = await request(app).get("/api/companions");
    expect(res.status).toBe(200);
    expect(res.body.map((m: Manifest) => m.name)).toEqual(["x"]);
  });

  it("POST /api/entities creates an entity", async () => {
    const res = await request(app)
      .post("/api/entities")
      .send({ companion: "x", input: { foo: 1 } });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^x-[0-9a-f]{6}$/);
    expect(res.body.status).toBe("pending");
    expect(res.body.input).toEqual({ foo: 1 });
  });

  it("POST /api/entities 404s on unknown companion", async () => {
    const res = await request(app)
      .post("/api/entities")
      .send({ companion: "nope", input: {} });
    expect(res.status).toBe(404);
  });

  it("GET /api/entities/:id round-trips a created entity", async () => {
    const create = await request(app)
      .post("/api/entities")
      .send({ companion: "x", input: { a: 1 } });
    const got = await request(app).get(`/api/entities/${create.body.id}?companion=x`);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(create.body.id);
  });

  it("GET /api/entities?companion=x lists", async () => {
    await request(app).post("/api/entities").send({ companion: "x", input: {} });
    await request(app).post("/api/entities").send({ companion: "x", input: {} });
    const res = await request(app).get("/api/entities?companion=x");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("POST /api/entities/:id/continue flips to pending", async () => {
    const c = await request(app).post("/api/entities").send({ companion: "x", input: {} });
    // simulate completion
    const store = createEntityStore(tmp);
    await store.saveArtifact("x", c.body.id, { done: true });
    const res = await request(app)
      .post(`/api/entities/${c.body.id}/continue`)
      .send({ companion: "x", continuation: "try again" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
    expect(res.body.input.continuation).toBe("try again");
  });

  it("GET /api/companions/:name/preflight returns ok:true for companion with no env declared", async () => {
    const res = await request(app).get("/api/companions/x/preflight");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, missingRequired: [], missingOptional: [] });
  });

  it("GET /api/companions/:name/preflight 404s for unknown companion", async () => {
    const res = await request(app).get("/api/companions/nope/preflight");
    expect(res.status).toBe(404);
  });
});

describe("preflight with required env", () => {
  let envBackup: string | undefined;

  beforeEach(() => {
    envBackup = process.env.X_TOKEN;
    delete process.env.X_TOKEN;
  });

  afterEach(() => {
    if (envBackup !== undefined) process.env.X_TOKEN = envBackup;
    else delete process.env.X_TOKEN;
  });

  function setupAppWithEnv(reqEnv: string[], optEnv: string[] = []) {
    const tmp2 = mkdtempSync(join(tmpdir(), "claudepanion-pf-"));
    const store = createEntityStore(tmp2);
    const m: Manifest = { ...manifest("env-test"), requiredEnv: reqEnv, optionalEnv: optEnv };
    const registry = createRegistry([{ manifest: m, tools: [] }]);
    const app2 = express();
    app2.use(express.json());
    mountApiRoutes(app2, { store, registry });
    return app2;
  }

  it("preflight reports missingRequired when env not set", async () => {
    const a = setupAppWithEnv(["X_TOKEN"]);
    const res = await request(a).get("/api/companions/env-test/preflight");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.missingRequired).toEqual(["X_TOKEN"]);
  });

  it("preflight returns ok:true when required env is set", async () => {
    process.env.X_TOKEN = "value";
    const a = setupAppWithEnv(["X_TOKEN"]);
    const res = await request(a).get("/api/companions/env-test/preflight");
    expect(res.body.ok).toBe(true);
    expect(res.body.missingRequired).toEqual([]);
  });

  it("preflight reports missingOptional but ok:true when only optional is missing", async () => {
    const a = setupAppWithEnv([], ["OPT_TOKEN"]);
    const res = await request(a).get("/api/companions/env-test/preflight");
    expect(res.body.ok).toBe(true);
    expect(res.body.missingOptional).toEqual(["OPT_TOKEN"]);
  });
});
