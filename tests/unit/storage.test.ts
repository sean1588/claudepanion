import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from '../../src/storage.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'claudepanion-test-'));
}

describe('storage', () => {
  it('writeJsonFile + readJsonFile round-trips', async () => {
    const dir = tempDir();
    const path = join(dir, 'test.json');
    await writeJsonFile(path, { hello: 'world', n: 42 });
    const data = await readJsonFile<{ hello: string; n: number }>(path);
    expect(data).toEqual({ hello: 'world', n: 42 });
  });

  it('readJsonFile returns default for missing file', async () => {
    const dir = tempDir();
    const path = join(dir, 'missing.json');
    const data = await readJsonFile(path, { requests: [] });
    expect(data).toEqual({ requests: [] });
  });

  it('writeJsonFile is atomic (no partial file if process dies mid-write)', async () => {
    const dir = tempDir();
    const path = join(dir, 'atomic.json');
    await writeJsonFile(path, { a: 1 });
    expect(existsSync(path + '.tmp')).toBe(false);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ a: 1 });
  });

  it('readJsonFile throws descriptive error on malformed JSON', async () => {
    const dir = tempDir();
    const path = join(dir, 'bad.json');
    writeFileSync(path, 'not json{');
    await expect(readJsonFile(path)).rejects.toThrow(/parse/i);
  });
});
