import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Express, Request, Response } from 'express';
import type { Broadcaster } from './broadcast.js';
import type { Companion, CompanionContext } from './types.js';
import { createRequestStore } from './helpers/requestStore.js';

export function createMcpServer(companions: Companion[], broadcaster: Broadcaster): McpServer {
  const server = new McpServer({ name: 'claudepanion', version: '0.3.0' });
  for (const companion of companions) {
    const ctx: CompanionContext = {
      slug: companion.slug,
      broadcast: broadcaster.broadcast,
      store: createRequestStore(companion.slug) as unknown as CompanionContext['store'],
      log: (...args) => console.error(`[${companion.slug}]`, ...args),
    };
    for (const tool of companion.tools) {
      server.tool(
        tool.name,
        tool.description,
        tool.schema,
        async (params) => tool.handler(params as Record<string, unknown>, ctx),
      );
    }
  }
  return server;
}

export function mountMcp(
  app: Express,
  broadcaster: Broadcaster,
  companions: Companion[],
): void {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.header('mcp-session-id');

    if (req.method === 'POST') {
      const body = req.body;
      const isInit = Array.isArray(body)
        ? body.some((m: { method?: string }) => m?.method === 'initialize')
        : body?.method === 'initialize';

      if (isInit) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
        transport.onerror = (err) => console.error('[mcp] transport error:', err);
        const server = createMcpServer(companions, broadcaster);
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        if (transport.sessionId) transports.set(transport.sessionId, transport);
        return;
      }

      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: no valid session id' },
          id: null,
        });
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res, body);
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: 'Invalid or missing session ID' });
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res);
      if (req.method === 'DELETE') transports.delete(sessionId);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  });
}
