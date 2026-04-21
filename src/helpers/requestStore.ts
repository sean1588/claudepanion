import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { readJsonFile, writeJsonFile } from '../storage.js';

export type RequestStatus = 'pending' | 'running' | 'done' | 'failed';

export interface FileRef {
  path: string;
  bytes: number;
}

export interface LogEntry {
  at: string;
  message: string;
}

export interface CompanionRequest {
  id: string;
  version: number;
  status: RequestStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
  logs: LogEntry[];
  result: { summary: string; files: FileRef[] } | null;
  error: string | null;
}

interface FileShape {
  requests: CompanionRequest[];
}

function dataDir(): string {
  return process.env.CLAUDEPANION_DATA_DIR ?? join(process.cwd(), 'data');
}

export interface RequestStore {
  list(): Promise<CompanionRequest[]>;
  get(id: string): Promise<CompanionRequest | null>;
  create(description: string): Promise<CompanionRequest>;
  claim(id: string, expectedVersion: number): Promise<CompanionRequest>;
  log(id: string, message: string): Promise<void>;
  complete(id: string, result: { summary: string; files: FileRef[] }): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  reset(id: string): Promise<void>;
  buildRouter(): Router;
}

export function createRequestStore(slug: string): RequestStore {
  const path = () => join(dataDir(), `${slug}.json`);

  async function load(): Promise<FileShape> {
    return readJsonFile<FileShape>(path(), { requests: [] });
  }

  async function save(data: FileShape): Promise<void> {
    await writeJsonFile(path(), data);
  }

  async function update(
    id: string,
    fn: (req: CompanionRequest) => CompanionRequest,
  ): Promise<CompanionRequest> {
    const data = await load();
    const idx = data.requests.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`request ${id} not found`);
    const next = fn(data.requests[idx]);
    data.requests[idx] = next;
    await save(data);
    return next;
  }

  const store: RequestStore = {
    async list() {
      return (await load()).requests;
    },
    async get(id) {
      return (await load()).requests.find((r) => r.id === id) ?? null;
    },
    async create(description) {
      const now = new Date().toISOString();
      const req: CompanionRequest = {
        id: randomUUID(),
        version: 1,
        status: 'pending',
        description,
        createdAt: now,
        updatedAt: now,
        logs: [],
        result: null,
        error: null,
      };
      const data = await load();
      data.requests.push(req);
      await save(data);
      return req;
    },
    async claim(id, expectedVersion) {
      return update(id, (r) => {
        if (r.version !== expectedVersion) {
          throw new Error(
            `version conflict on ${id}: expected ${expectedVersion}, have ${r.version}`,
          );
        }
        if (r.status !== 'pending') {
          throw new Error(`cannot claim ${id}: status is ${r.status}, not pending`);
        }
        return {
          ...r,
          status: 'running',
          version: r.version + 1,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    async log(id, message) {
      await update(id, (r) => ({
        ...r,
        version: r.version + 1,
        updatedAt: new Date().toISOString(),
        logs: [...r.logs, { at: new Date().toISOString(), message }],
      }));
    },
    async complete(id, result) {
      await update(id, (r) => ({
        ...r,
        status: 'done',
        version: r.version + 1,
        updatedAt: new Date().toISOString(),
        result,
      }));
    },
    async fail(id, error) {
      await update(id, (r) => ({
        ...r,
        status: 'failed',
        version: r.version + 1,
        updatedAt: new Date().toISOString(),
        error,
      }));
    },
    async reset(id) {
      await update(id, (r) => ({
        ...r,
        status: 'pending',
        version: r.version + 1,
        updatedAt: new Date().toISOString(),
      }));
    },
    buildRouter() {
      const router = Router();
      router.post('/requests', async (req: Request, res: Response) => {
        const description = String(req.body?.description ?? '').trim();
        if (!description) {
          res.status(400).json({ error: 'description is required' });
          return;
        }
        const created = await store.create(description);
        res.status(201).json({ request: created });
      });
      router.post('/requests/:id/reset', async (req: Request, res: Response) => {
        await store.reset(req.params.id);
        res.json({ ok: true });
      });
      router.get('/requests', async (_req: Request, res: Response) => {
        res.json({ requests: await store.list() });
      });
      router.get('/requests/:id', async (req: Request, res: Response) => {
        const r = await store.get(req.params.id);
        if (!r) {
          res.status(404).json({ error: 'request not found' });
          return;
        }
        res.json({ request: r });
      });
      return router;
    },
  };

  return store;
}
