import type { Express, Request, Response } from "express";
import type { EntityStore } from "./entity-store.js";
import type { Registry } from "./companion-registry.js";
import { generateEntityId } from "./id.js";

export interface ApiDeps {
  store: EntityStore;
  registry: Registry;
}

export function mountApiRoutes(app: Express, { store, registry }: ApiDeps): void {
  app.get("/api/companions", (_req: Request, res: Response) => {
    res.json(registry.list().map((c) => c.manifest));
  });

  app.get("/api/entities", async (req: Request, res: Response) => {
    const companion = String(req.query.companion ?? "");
    if (!companion) return res.status(400).json({ error: "companion query param required" });
    if (!registry.get(companion)) return res.status(404).json({ error: `unknown companion: ${companion}` });
    res.json(await store.list(companion));
  });

  app.get("/api/entities/:id", async (req: Request, res: Response) => {
    const companion = String(req.query.companion ?? "");
    if (!companion) return res.status(400).json({ error: "companion query param required" });
    const e = await store.get(companion, req.params.id);
    if (!e) return res.status(404).json({ error: "not found" });
    res.json(e);
  });

  app.post("/api/entities", async (req: Request, res: Response) => {
    const { companion, input } = req.body ?? {};
    if (!companion || typeof companion !== "string") {
      return res.status(400).json({ error: "companion required" });
    }
    if (!registry.get(companion)) {
      return res.status(404).json({ error: `unknown companion: ${companion}` });
    }
    const id = generateEntityId(companion);
    const entity = await store.create({ id, companion, input: input ?? {} });
    res.status(201).json(entity);
  });

  app.post("/api/entities/:id/continue", async (req: Request, res: Response) => {
    const { companion, continuation } = req.body ?? {};
    if (!companion) return res.status(400).json({ error: "companion required" });
    if (typeof continuation !== "string" || !continuation.trim()) {
      return res.status(400).json({ error: "continuation text required" });
    }
    await store.continueWith(companion, req.params.id, continuation);
    const e = await store.get(companion, req.params.id);
    res.json(e);
  });
}
