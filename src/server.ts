import { join } from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { loadCompanions } from './companions.js';
import { createBroadcaster } from './broadcast.js';
import { mountMcp } from './mcp.js';
import { createRequestStore } from './helpers/requestStore.js';
import { layout } from './ui/layout.js';
import type { Companion, CompanionContext } from './types.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const repoRoot = process.env.CLAUDEPANION_REPO_ROOT ?? process.cwd();
const companionsDir = process.env.CLAUDEPANION_COMPANIONS_DIR ?? join(repoRoot, 'companions');

app.use(express.json());

// ── UI broadcast (SSE stream for browsers) ────────────────────────────
const broadcaster = createBroadcaster();

interface SseClient {
  sendEvent: (event: string, data: unknown) => void;
}

const sseClients = new Map<number, SseClient>();
let sseClientId = 0;

broadcaster.subscribe((event, data) => {
  for (const client of sseClients.values()) {
    try { client.sendEvent(event, data); } catch { /* closed */ }
  }
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const id = ++sseClientId;
  sseClients.set(id, {
    sendEvent(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(id);
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, companions: companions.map((c) => c.slug) });
});

// ── Load companions and mount everything ──────────────────────────────
let companions: Companion[] = [];

async function boot(): Promise<void> {
  companions = await loadCompanions(companionsDir);
  console.log(`[claudepanion] loaded ${companions.length} companion(s): ${companions.map((c) => c.slug).join(', ')}`);

  mountMcp(app, broadcaster, companions);

  for (const c of companions) {
    if (c.router) {
      app.use(`/api/c/${c.slug}`, c.router);
    }
    app.get(`/c/${c.slug}`, async (_req: Request, res: Response) => {
      const ctx: CompanionContext = {
        slug: c.slug,
        broadcast: broadcaster.broadcast,
        store: createRequestStore(c.slug) as unknown as CompanionContext['store'],
        log: (...args) => console.error(`[${c.slug}]`, ...args),
      };
      const body = await c.renderPage(ctx);
      res.type('html').send(layout(c.name, c.slug, body, companions));
    });
  }

  app.get('/', (_req, res) => {
    if (companions.length === 0) {
      res.type('html').send(layout('No companions', '', '<p>No companions installed. Add one under <code>companions/</code>.</p>', []));
      return;
    }
    res.redirect(`/c/${companions[0].slug}`);
  });

  app.listen(port, () => {
    console.log(`\n  claudepanion running at http://localhost:${port}`);
    console.log(`  MCP endpoint:   http://localhost:${port}/mcp`);
    console.log(`  Events stream:  http://localhost:${port}/events\n`);
  });
}

boot().catch((err) => {
  console.error('[claudepanion] failed to start:', err);
  process.exit(1);
});
