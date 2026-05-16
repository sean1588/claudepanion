import express from "express";
import { join, resolve } from "node:path";
import { statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Framework root (where this compiled file lives in dist/src/server/) — used
// for resolving static client assets that ship with the framework, regardless
// of the user's runtime cwd.
const frameworkRoot = resolve(fileURLToPath(import.meta.url), "../../../..");
import { createEntityStore } from "./entity-store.js";
import { createRegistry, type RegisteredCompanion } from "./companion-registry.js";
import { mountApiRoutes } from "./api-routes.js";
import { buildMcpServer } from "./mcp.js";
import { createWatcher, type ReliabilitySnapshot, type MountFailure } from "./reliability/watcher.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { dataPath, ensureClaudepanionDirs } from "./paths.js";
import { bumpMcpStatus } from "./mcp-status.js";

export interface BootOptions {
  /** Pre-resolved list of companions to register. Caller is responsible for loading these from user-local dist. */
  companions: RegisteredCompanion[];
  /** Server port (default: 3001 or PORT env). */
  port?: number;
  /** Runtime root for the watcher + codegen (where companions/*, dist/, skills/ live). Default: process.cwd(). */
  cwd?: string;
}

function checkTscHealth(repoRoot: string): void {
  // The .tsbuildinfo health check is framework-repo specific — it warns devs
  // working from a clone with stale or missing tsc-incremental output. In a
  // user-local install (~/.claudepanion/), the home's tsc is invoked by
  // `claudepanion init`/`scaffold` directly and doesn't use incremental mode,
  // so .tsbuildinfo is legitimately absent. Skip the check there.
  try {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf-8"));
    if (pkg.name === "claudepanion-home") return;
  } catch {
    // No package.json → fall through to the existing check.
  }
  const tsBuildInfo = resolve(repoRoot, "dist/.tsbuildinfo");
  try {
    const stat = statSync(tsBuildInfo);
    const ageSec = (Date.now() - stat.mtimeMs) / 1000;
    if (ageSec > 600) {
      console.warn(
        `[claudepanion] dist/.tsbuildinfo is ${Math.round(ageSec)}s old. ` +
        `If you're developing companions, run 'npm run dev:tsc' so the watcher can pick up changes.`
      );
    }
  } catch {
    console.warn(
      `[claudepanion] dist/.tsbuildinfo not found. ` +
      `Run 'npm run build' or 'npm run dev' before scaffolding companions.`
    );
  }
}

export async function bootServer(opts: BootOptions): Promise<void> {
  const port = opts.port ?? Number(process.env.PORT ?? 3001);
  const repoRoot = opts.cwd ?? process.cwd();

  ensureClaudepanionDirs();
  const store = createEntityStore(dataPath());
  const registry = createRegistry(opts.companions);
  const snapshots = new Map<string, ReliabilitySnapshot>();
  const mountFailures = new Map<string, MountFailure>();
  const companionsDir = resolve(repoRoot, "companions");
  const mcp = buildMcpServer({ store, registry, companionsDir, snapshots });
  const watcher = createWatcher({
    registry,
    companionsDir,
    snapshots,
    mountFailures,
  });

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  mountApiRoutes(app, {
    store,
    registry,
    reliability: snapshots,
    mountFailures,
    triggerRemount: async (slug) => {
      try {
        await watcher.triggerRemount(slug);
        const c = registry.get(slug);
        return c ? { ok: true, version: c.manifest.version } : { ok: false, error: "remount completed but companion not registered" };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  });

  const mcpServer = new McpServer({ name: "claudepanion", version: "0.2.0" });
  const registeredTools = new Set<string>();
  const registerToolDef = (name: string) => {
    if (registeredTools.has(name)) return;
    registeredTools.add(name);
    const def = mcp.toolDefs.get(name)!;
    mcpServer.registerTool(
      name,
      { description: def.description, inputSchema: z.object(def.schema) },
      async (args) => {
        // Look up current def so handler updates survive a companion hot-reload.
        const current = mcp.toolDefs.get(name);
        if (!current) throw new Error(`tool ${name} no longer registered`);
        return await current.handler(args as any);
      }
    );
  };
  for (const name of mcp.toolDefs.keys()) registerToolDef(name);
  registry.onChange(() => {
    for (const name of mcp.toolDefs.keys()) registerToolDef(name);
  });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  await mcpServer.connect(transport);
  app.all("/mcp", (req, res) => {
    bumpMcpStatus();
    transport.handleRequest(req, res, req.body);
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  });

  const clientDir = join(frameworkRoot, "dist/client");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => res.sendFile(join(clientDir, "index.html")));

  app.listen(port, () => {
    console.log(`claudepanion listening on http://localhost:${port}`);
    checkTscHealth(repoRoot);
  });

  const shutdown = async () => {
    await watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
