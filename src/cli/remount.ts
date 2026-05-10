export async function callRemount(slug: string, port = 3001): Promise<{ ok: boolean; error?: string; version?: string }> {
  try {
    const res = await fetch(`http://localhost:${port}/api/internal/remount?slug=${encodeURIComponent(slug)}`, {
      method: "POST",
    });
    const json = await res.json() as { ok: boolean; error?: string; version?: string };
    return json;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
