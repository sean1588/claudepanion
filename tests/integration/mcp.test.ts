import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mountMcp } from '../../src/mcp.js';
import type { Companion } from '../../src/types.js';
import { createBroadcaster } from '../../src/broadcast.js';
import { z } from 'zod';

function makeCompanion(): Companion {
  return {
    slug: 'demo',
    name: 'Demo',
    description: 'd',
    tools: [
      {
        name: 'demo_ping',
        description: '[demo] ping',
        schema: { msg: z.string() },
        async handler(params) {
          return { content: [{ type: 'text', text: `pong:${(params as { msg: string }).msg}` }] };
        },
      },
    ],
    renderPage: () => '',
    router: null,
  };
}

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  const app = express();
  app.use(express.json());
  const broadcaster = createBroadcaster();
  mountMcp(app, broadcaster, [makeCompanion()]);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(() => {
  server.close();
});

describe('MCP mount', () => {
  it('initialize returns a session id and lists companion tool', async () => {
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '0' },
        },
      }),
    });
    expect(initRes.status).toBe(200);
    const sid = initRes.headers.get('mcp-session-id');
    expect(sid).toBeTruthy();

    const listRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sid!,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    const listText = await listRes.text();
    expect(listText).toMatch(/demo_ping/);
  });
});
