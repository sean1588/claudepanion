import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Express, Request, Response } from 'express';
import { mcpTools } from './tools/index.js';
import { Broadcast, McpToolContext } from './types.js';

export function createMcpServer(context: McpToolContext): McpServer {
  const server = new McpServer({ name: 'claude-manager', version: '0.2.0' });
  for (const tool of mcpTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      async (params) => tool.handler(params as Record<string, unknown>, context),
    );
  }
  return server;
}

export function mountMcp(app: Express, broadcast: Broadcast): void {
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const context: McpToolContext = { broadcast };

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
        const server = createMcpServer(context);
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
