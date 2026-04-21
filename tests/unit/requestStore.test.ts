import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequestStore } from '../../src/helpers/requestStore.js';

function tempDataDir() {
  const d = mkdtempSync(join(tmpdir(), 'cp-req-'));
  process.env.CLAUDEPANION_DATA_DIR = d;
  return d;
}

describe('requestStore', () => {
  beforeEach(() => {
    tempDataDir();
  });

  it('create → list sees pending request', async () => {
    const s = createRequestStore('build');
    const req = await s.create('do the thing');
    expect(req.status).toBe('pending');
    expect(req.version).toBe(1);
    expect(req.description).toBe('do the thing');
    const all = await s.list();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(req.id);
  });

  it('claim moves pending → running and bumps version', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    const claimed = await s.claim(r.id, r.version);
    expect(claimed.status).toBe('running');
    expect(claimed.version).toBe(r.version + 1);
  });

  it('claim with stale version rejects with conflict', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await expect(s.claim(r.id, r.version)).rejects.toThrow(/version|conflict/i);
  });

  it('claim on non-pending status rejects', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    const latest = (await s.get(r.id))!;
    await expect(s.claim(r.id, latest.version)).rejects.toThrow(/status|pending/i);
  });

  it('log appends entries and bumps version', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await s.log(r.id, 'first');
    await s.log(r.id, 'second');
    const got = (await s.get(r.id))!;
    expect(got.logs.map((l) => l.message)).toEqual(['first', 'second']);
  });

  it('complete sets done + result', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await s.complete(r.id, {
      summary: '# done',
      files: [{ path: 'companions/x/manifest.json', bytes: 10 }],
    });
    const got = (await s.get(r.id))!;
    expect(got.status).toBe('done');
    expect(got.result?.summary).toBe('# done');
  });

  it('fail sets failed + error', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await s.fail(r.id, 'kaboom');
    const got = (await s.get(r.id))!;
    expect(got.status).toBe('failed');
    expect(got.error).toBe('kaboom');
  });

  it('reset forces status back to pending', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await s.reset(r.id);
    const got = (await s.get(r.id))!;
    expect(got.status).toBe('pending');
  });
});
