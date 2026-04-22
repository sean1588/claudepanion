import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCompanions } from '../../src/companions.js';
import { createBroadcaster } from '../../src/broadcast.js';
import { mountMcp } from '../../src/mcp.js';

let server: Server;
let baseUrl: string;
let dataDir: string;
let repoRoot: string;

async function initSession(): Promise<string> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
    }),
  });
  return res.headers.get('mcp-session-id')!;
}

async function callTool(sid: string, name: string, args: unknown, id: number): Promise<string> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-session-id': sid },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
  });
  return res.text();
}

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'e2e-data-'));
  repoRoot = mkdtempSync(join(tmpdir(), 'e2e-repo-'));
  process.env.CLAUDEPANION_DATA_DIR = dataDir;
  process.env.CLAUDEPANION_REPO_ROOT = repoRoot;

  const app = express();
  app.use(express.json());
  const broadcaster = createBroadcaster();
  const companions = await loadCompanions(join(process.cwd(), 'companions'));
  mountMcp(app, broadcaster, companions);
  for (const c of companions) {
    if (c.router) app.use(`/api/c/${c.slug}`, c.router);
  }
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  server.close();
});

describe('Build end-to-end', () => {
  it('POST create → MCP claim → log → complete writes scaffolded files', async () => {
    // 1. UI submits a build request
    const createRes = await fetch(`${baseUrl}/api/c/build/requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'scaffold a notes companion' }),
    });
    expect(createRes.status).toBe(201);
    const { request: req } = await createRes.json();
    expect(req.status).toBe('pending');

    // 2. Claude initializes MCP session, lists, claims
    const sid = await initSession();
    const listOut = await callTool(sid, 'build_list', {}, 2);
    expect(listOut).toMatch(req.id);

    const claimOut = await callTool(sid, 'build_claim', { id: req.id, expectedVersion: req.version }, 3);
    expect(claimOut).not.toMatch(/isError.*true/);

    // 3. Claude logs progress
    await callTool(sid, 'build_log', { id: req.id, message: 'writing manifest' }, 4);

    // 4. Claude completes with files
    const completeOut = await callTool(sid, 'build_complete', {
      id: req.id,
      summary: '# Scaffolded `notes`',
      files: [
        { path: 'companions/notes/manifest.json', content: '{"slug":"notes","name":"Notes","description":"A notes companion"}' },
        { path: 'skills/notes/SKILL.md', content: '---\nname: notes\n---\n# Notes' },
      ],
    }, 5);
    expect(completeOut).not.toMatch(/isError.*true/);

    // 5. Files landed at scaffolded paths
    const manifestPath = join(repoRoot, 'companions/notes/manifest.json');
    const skillPath = join(repoRoot, 'skills/notes/SKILL.md');
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(skillPath)).toBe(true);
    expect(JSON.parse(readFileSync(manifestPath, 'utf8'))).toMatchObject({ slug: 'notes' });

    // 6. data/build.json has the done request
    const buildData = JSON.parse(readFileSync(join(dataDir, 'build.json'), 'utf8'));
    expect(buildData.requests[0].status).toBe('done');
    expect(buildData.requests[0].result.files).toHaveLength(2);
  });

  it('UI reset endpoint unsticks a stuck running request', async () => {
    const createRes = await fetch(`${baseUrl}/api/c/build/requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    });
    const { request: req } = await createRes.json();

    const sid = await initSession();
    await callTool(sid, 'build_claim', { id: req.id, expectedVersion: req.version }, 2);

    const resetRes = await fetch(`${baseUrl}/api/c/build/requests/${req.id}/reset`, {
      method: 'POST',
    });
    expect(resetRes.status).toBe(200);

    const buildData = JSON.parse(readFileSync(join(dataDir, 'build.json'), 'utf8'));
    expect(buildData.requests[0].status).toBe('pending');
  });
});
