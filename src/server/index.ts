import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createEntityStore } from "./entity-store.js";
import { createRegistry } from "./companion-registry.js";
import { mountApiRoutes } from "./api-routes.js";
import { buildMcpServer } from "./mcp.js";
import { companions } from "../../companions/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");

async function main() {
  const store = createEntityStore(resolve(repoRoot, "data"));
  const registry = createRegistry(companions);
  const mcp = buildMcpServer({ store, registry });

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  mountApiRoutes(app, { store, registry });

  const mcpServer = new McpServer({ name: "claudepanion", version: "0.2.0" });
  for (const [name, handler] of Object.entries(mcp.handlers)) {
    mcpServer.registerTool(
      name,
      { description: `auto-registered handler for ${name}`, inputSchema: z.any() },
      async (args: unknown) => {
        const result = await handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      }
    );
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  await mcpServer.connect(transport);
  app.all("/mcp", (req, res) => transport.handleRequest(req, res, req.body));

  const clientDir = join(repoRoot, "dist/client");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => res.sendFile(join(clientDir, "index.html")));

  app.listen(PORT, () => {
    console.log(`claudepanion listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
