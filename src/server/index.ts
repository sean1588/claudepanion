import express from "express";
import { join, resolve } from "node:path";
import { createEntityStore } from "./entity-store.js";
import { createRegistry } from "./companion-registry.js";
import { mountApiRoutes } from "./api-routes.js";
import { buildMcpServer } from "./mcp.js";
import { createWatcher, type ReliabilitySnapshot } from "./reliability/watcher.js";
import { companions } from "../../companions/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3001);
const repoRoot = process.cwd();

async function main() {
  const store = createEntityStore(resolve(repoRoot, "data"));
  const registry = createRegistry(companions);
  const mcp = buildMcpServer({ store, registry });
  const snapshots = new Map<string, ReliabilitySnapshot>();
  const watcher = createWatcher({
    registry,
    companionsDir: resolve(repoRoot, "companions"),
    snapshots,
  });

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  mountApiRoutes(app, { store, registry, reliability: snapshots });

  const mcpServer = new McpServer({ name: "claudepanion", version: "0.2.0" });
  const registeredTools = new Set<string>();
  const registerTool = (name: string) => {
    if (registeredTools.has(name)) return;
    registeredTools.add(name);
    mcpServer.registerTool(
      name,
      { description: `auto-registered handler for ${name}`, inputSchema: z.any() },
      async (args: unknown) => {
        const fn = mcp.handlers[name];
        if (!fn) throw new Error(`unknown tool: ${name}`);
        const result = await fn(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      }
    );
  };
  for (const name of Object.keys(mcp.handlers)) registerTool(name);
  registry.onChange(() => {
    for (const name of Object.keys(mcp.handlers)) registerTool(name);
  });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  await mcpServer.connect(transport);
  app.all("/mcp", (req, res) => transport.handleRequest(req, res, req.body));

  const clientDir = join(repoRoot, "dist/client");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => res.sendFile(join(clientDir, "index.html")));

  app.listen(PORT, () => {
    console.log(`claudepanion listening on http://localhost:${PORT}`);
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
