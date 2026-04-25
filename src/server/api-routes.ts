import type { Express, Request, Response } from "express";
import type { EntityStore } from "./entity-store.js";
import type { Registry } from "./companion-registry.js";
import type { ReliabilitySnapshot } from "./reliability/watcher.js";
import { generateEntityId } from "./id.js";
import type { CompanionToolDefinition } from "../shared/types.js";
import { spawn } from "node:child_process";
import { validateCompanion } from "./reliability/validator.js";
import type { RegisteredCompanion } from "./companion-registry.js";
import { rewriteCompanionsIndex } from "./companions-index.js";

export interface ApiDeps {
  store: EntityStore;
  registry: Registry;
  reliability?: Map<string, ReliabilitySnapshot>;
}

export function mountApiRoutes(app: Express, { store, registry, reliability }: ApiDeps): void {
  app.get("/api/reliability/:companion", (req: Request, res: Response) => {
    const name = String(req.params.companion);
    if (!registry.get(name)) return res.status(404).json({ error: `unknown companion: ${name}` });
    const snap = reliability?.get(name);
    if (!snap) return res.status(503).json({ error: "reliability snapshot not yet computed" });
    res.json(snap);
  });

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
    const e = await store.get(companion, String(req.params.id));
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

  app.get("/api/tools/:companion", (req: Request, res: Response) => {
    const name = String(req.params.companion);
    const c = registry.get(name);
    if (!c) return res.status(404).json({ error: `unknown companion: ${name}` });
    if (c.manifest.kind !== "tool") return res.status(400).json({ error: `${name} is not a tool-kind companion` });
    const descriptors = c.tools.map((def) => ({
      name: def.name,
      description: def.description,
      params: Object.entries(def.schema).map(([key, schema]) => ({
        name: key,
        required: !schema.isOptional(),
        description: (schema as any)._def?.description ?? "",
      })),
      signature: signatureFromDef(def),
    }));
    res.json({ manifest: c.manifest, tools: descriptors });
  });

  app.post("/api/tools/:companion/:tool", async (req: Request, res: Response) => {
    const name = String(req.params.companion);
    const toolName = String(req.params.tool);
    const c = registry.get(name);
    if (!c) return res.status(404).json({ error: `unknown companion: ${name}` });
    if (c.manifest.kind !== "tool") return res.status(400).json({ error: `${name} is not a tool-kind companion` });
    const def = c.tools.find((t) => t.name === toolName);
    if (!def) return res.status(404).json({ error: `unknown tool: ${toolName}` });
    try {
      const result = await def.handler((req.body ?? {}).args ?? {});
      res.json({ ok: true, result });
    } catch (err: unknown) {
      const e = err as Error;
      res.json({ ok: false, error: e?.message ?? String(err) });
    }
  });

  app.post("/api/install", async (req: Request, res: Response) => {
    const { packageName } = req.body ?? {};
    if (typeof packageName !== "string" || !/^claudepanion-[a-z0-9-]+$/.test(packageName)) {
      return res.status(400).json({ ok: false, error: "packageName must match claudepanion-<slug>" });
    }

    const npmResult = await new Promise<{ code: number; stderr: string }>((resolve) => {
      const proc = spawn("npm", ["install", packageName], { cwd: process.cwd(), shell: false });
      let stderr = "";
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => resolve({ code: code ?? 1, stderr }));
      proc.on("error", (err) => resolve({ code: 1, stderr: err.message }));
    });

    if (npmResult.code !== 0) {
      return res.status(500).json({ ok: false, error: `npm install failed: ${npmResult.stderr || "(no stderr)"}`.slice(0, 2000) });
    }

    let companion: RegisteredCompanion;
    try {
      const mod = await import(packageName);
      companion = (mod.default ?? Object.values(mod).find((v: any) => v?.manifest)) as RegisteredCompanion;
      if (!companion?.manifest) throw new Error("package did not export a RegisteredCompanion");
    } catch (err) {
      return res.status(500).json({ ok: false, error: `import failed: ${(err as Error).message}` });
    }

    const report = validateCompanion({ manifest: companion.manifest, module: companion, companionDir: null });
    if (!report.ok) {
      return res.status(400).json({ ok: false, error: `validation failed: ${report.issues.filter((i) => i.fatal).map((i) => i.message).join("; ")}` });
    }

    try {
      registry.register({ ...companion, source: "installed" });
    } catch (err) {
      return res.status(409).json({ ok: false, error: (err as Error).message });
    }

    try {
      await rewriteCompanionsIndex(process.cwd(), registry);
    } catch (err) {
      return res.status(500).json({ ok: false, error: `registered but failed to persist: ${(err as Error).message}` });
    }

    res.json({ ok: true, companion: companion.manifest });
  });

  app.post("/api/entities/:id/continue", async (req: Request, res: Response) => {
    const { companion, continuation } = req.body ?? {};
    if (!companion) return res.status(400).json({ error: "companion required" });
    if (typeof continuation !== "string" || !continuation.trim()) {
      return res.status(400).json({ error: "continuation text required" });
    }
    await store.continueWith(companion, String(req.params.id), continuation);
    const e = await store.get(companion, String(req.params.id));
    res.json(e);
  });
}

function signatureFromDef(def: CompanionToolDefinition): string {
  const params = Object.entries(def.schema).map(([key, schema]) => {
    return `${key}${schema.isOptional() ? "?" : ""}: …`;
  });
  return params.length ? `${def.name}(${params.join(", ")})` : `${def.name}()`;
}
