// tests/server/entity-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore, type EntityStore } from "../../src/server/entity-store";

let store: EntityStore;
let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "claudepanion-test-"));
  store = createEntityStore(tmp);
});

afterEach(() => {
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
});

describe("entity store", () => {
  it("creates an entity in pending state with empty logs", async () => {
    const e = await store.create({
      id: "x-abc",
      companion: "x",
      input: { foo: 1 },
    });
    expect(e.status).toBe("pending");
    expect(e.logs).toEqual([]);
    expect(e.artifact).toBeNull();
    expect(e.input).toEqual({ foo: 1 });
    expect(e.createdAt).toEqual(e.updatedAt);
  });

  it("round-trips an entity through get", async () => {
    await store.create({ id: "x-1", companion: "x", input: { a: 1 } });
    const got = await store.get("x", "x-1");
    expect(got?.id).toBe("x-1");
    expect(got?.input).toEqual({ a: 1 });
  });

  it("returns null for missing entity", async () => {
    expect(await store.get("x", "nope")).toBeNull();
  });

  it("lists entities for a companion", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    await store.create({ id: "x-2", companion: "x", input: {} });
    await store.create({ id: "y-1", companion: "y", input: {} });
    const xs = await store.list("x");
    expect(xs.map((e) => e.id).sort()).toEqual(["x-1", "x-2"]);
  });

  it("updates status and bumps updatedAt", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    const before = (await store.get("x", "x-1"))!.updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    await store.updateStatus("x", "x-1", "running", "step 1");
    const after = await store.get("x", "x-1");
    expect(after?.status).toBe("running");
    expect(after?.statusMessage).toBe("step 1");
    expect(after!.updatedAt > before).toBe(true);
  });

  it("appends a log entry", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    await store.appendLog("x", "x-1", "hello", "info");
    const e = await store.get("x", "x-1");
    expect(e?.logs.length).toBe(1);
    expect(e?.logs[0].message).toBe("hello");
    expect(e?.logs[0].level).toBe("info");
  });

  it("saves artifact and flips to completed", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    await store.saveArtifact("x", "x-1", { result: 42 });
    const e = await store.get("x", "x-1");
    expect(e?.artifact).toEqual({ result: 42 });
    expect(e?.status).toBe("completed");
  });

  it("marks as error with message and optional stack", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    await store.fail("x", "x-1", "boom", "stack trace");
    const e = await store.get("x", "x-1");
    expect(e?.status).toBe("error");
    expect(e?.errorMessage).toBe("boom");
    expect(e?.errorStack).toBe("stack trace");
  });

  it("continuation flips back to pending and preserves artifact as previous", async () => {
    await store.create({ id: "x-1", companion: "x", input: { original: true } });
    await store.saveArtifact("x", "x-1", { result: "v1" });
    await store.continueWith("x", "x-1", "make it better");
    const e = await store.get("x", "x-1");
    expect(e?.status).toBe("pending");
    expect((e?.input as any).continuation).toBe("make it better");
    expect((e?.input as any).previousArtifact).toEqual({ result: "v1" });
  });
});
