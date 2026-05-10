import express from "express";
import { join, resolve } from "node:path";
import { statSync } from "node:fs";
import { createEntityStore } from "./entity-store.js";
import { createRegistry } from "./companion-registry.js";
import { mountApiRoutes } from "./api-routes.js";
import { buildMcpServer } from "./mcp.js";
import { createWatcher, type ReliabilitySnapshot } from "./reliability/watcher.js";
import { companions } from "../../companions/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { dataPath, ensureClaudepanionDirs } from "./paths.js";

const PORT = Number(process.env.PORT ?? 3001);
const repoRoot = process.cwd();

function checkTscHealth(): void {
  const tsBuildInfo = resolve(process.cwd(), "dist/.tsbuildinfo");
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

async function main() {
  ensureClaudepanionDirs();
  const store = createEntityStore(dataPath());
  const registry = createRegistry(companions);
  const snapshots = new Map<string, ReliabilitySnapshot>();
  const companionsDir = resolve(repoRoot, "companions");
  const mcp = buildMcpServer({ store, registry, companionsDir, snapshots });
  const watcher = createWatcher({
    registry,
    companionsDir,
    snapshots,
  });

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  mountApiRoutes(app, {
    store,
    registry,
    reliability: snapshots,
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
  app.all("/mcp", (req, res) => transport.handleRequest(req, res, req.body));

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  });

  const clientDir = join(repoRoot, "dist/client");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => res.sendFile(join(clientDir, "index.html")));

  app.listen(PORT, () => {
    console.log(`claudepanion listening on http://localhost:${PORT}`);
    checkTscHealth();
  });

  const shutdown = async () => {
    await watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
