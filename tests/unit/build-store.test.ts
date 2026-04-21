import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { store } from '../../companions/build/store.js';

describe('build companion store', () => {
  beforeEach(() => {
    process.env.CLAUDEPANION_DATA_DIR = mkdtempSync(join(tmpdir(), 'build-s-'));
  });

  it('round-trips a request', async () => {
    const r = await store.create('scaffold a notes companion');
    const back = await store.get(r.id);
    expect(back?.description).toBe('scaffold a notes companion');
  });
});
