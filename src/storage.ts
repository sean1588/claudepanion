import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export async function readJsonFile<T>(
  path: string,
  defaultValue?: T,
): Promise<T> {
  try {
    const text = await fs.readFile(path, 'utf8');
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse JSON at ${path}: ${(err as Error).message}`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT' && defaultValue !== undefined) {
      return defaultValue;
    }
    throw err;
  }
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  const json = JSON.stringify(data, null, 2);
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(json);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, path);
}
