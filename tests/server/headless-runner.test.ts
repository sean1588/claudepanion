import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore } from "../../src/server/entity-store";
import { createRegistry } from "../../src/server/companion-registry";
import {
  createHeadlessRunner,
  companionAllowedTools,
  buildHeadlessPrompt,
  buildClaudeArgs,
  type SpawnFn,
} from "../../src/server/headless-runner";
import type { Manifest, CompanionToolDefinition } from "../../src/shared/types.js";
import { successResult } from "../../src/shared/types.js";

const manifest = (name: string, kind: "ui" | "tool" = "ui"): Manifest => ({
  name,
  kind,
  displayName: name,
  icon: "🧪",
  description: "t",
  contractVersion: "2",
  version: "0.0.1",
});

const tool = (name: string): CompanionToolDefinition => ({
  name,
  description: "",
  schema: {},
  async handler() {
    return successResult({});
  },
});

const companion = (name: string, tools: string[] = [], kind: "ui" | "tool" = "ui") => ({
  manifest: manifest(name, kind),
  tools: tools.map(tool),
});

/** Minimal stand-in for a spawned `claude` process. */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill() {
    this.killed = true;
    return true;
  }
}

const flush = () => new Promise((r) => setImmediate(r));

// ─── Pure builders ────────────────────────────────────────────────────────────

describe("companionAllowedTools", () => {
  it("includes the 6 lifecycle tools + proxy tools, all server-qualified", () => {
    const allow = companionAllowedTools(companion("notes", ["notes_fetch", "notes_post"]));
    expect(allow).toEqual([
      "mcp__claudepanion__notes_get",
      "mcp__claudepanion__notes_list",
      "mcp__claudepanion__notes_update_status",
      "mcp__claudepanion__notes_append_log",
      "mcp__claudepanion__notes_save_artifact",
      "mcp__claudepanion__notes_fail",
      "mcp__claudepanion__notes_fetch",
      "mcp__claudepanion__notes_post",
    ]);
  });

  it("omits lifecycle tools for tool-kind companions", () => {
    const allow = companionAllowedTools(companion("t", ["t_run"], "tool"));
    expect(allow).toEqual(["mcp__claudepanion__t_run"]);
  });
});

describe("buildClaudeArgs", () => {
  const args = buildClaudeArgs({
    prompt: "do it",
    skillInstructions: "SKILL BODY",
    mcpConfigPath: "/home/.claudepanion/.mcp.json",
    allowedTools: ["mcp__claudepanion__notes_get", "mcp__claudepanion__notes_fail"],
  });

  it("runs print mode with the prompt and inlines the skill as system prompt", () => {
    expect(args[0]).toBe("-p");
    expect(args[1]).toBe("do it");
    expect(args).toContain("--append-system-prompt");
    expect(args[args.indexOf("--append-system-prompt") + 1]).toBe("SKILL BODY");
  });

  it("scopes MCP to the companion config and the allowlist", () => {
    expect(args).toContain("--strict-mcp-config");
    expect(args[args.indexOf("--mcp-config") + 1]).toBe("/home/.claudepanion/.mcp.json");
    expect(args[args.indexOf("--allowedTools") + 1]).toBe(
      "mcp__claudepanion__notes_get,mcp__claudepanion__notes_fail"
    );
  });

  it("NEVER skips permissions", () => {
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("--allow-dangerously-skip-permissions");
    expect(args).not.toContain("bypassPermissions");
  });
});

describe("buildHeadlessPrompt", () => {
  it("names the entity, the get tool, and the no-human constraint", () => {
    const p = buildHeadlessPrompt("notes", "notes-abc");
    expect(p).toContain("notes-abc");
    expect(p).toContain("notes_get");
    expect(p).toMatch(/NO human/);
    expect(p).toMatch(/never pause/i);
  });
});

// ─── Runner behaviour ─────────────────────────────────────────────────────────

describe("createHeadlessRunner", () => {
  let tmp: string;
  let store: ReturnType<typeof createEntityStore>;
  const registry = createRegistry([companion("notes", ["notes_fetch"])]);

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "claudepanion-headless-"));
    store = createEntityStore(tmp);
  });

  const makeRunner = (spawnFn: SpawnFn, opts: Partial<Parameters<typeof createHeadlessRunner>[0]> = {}) =>
    createHeadlessRunner({
      store,
      registry,
      homeRoot: "/home/.claudepanion",
      readSkill: async () => "SKILL BODY",
      spawnFn,
      maxConcurrent: 1,
      ...opts,
    });

  it("spawns claude with the companion's allowlist", async () => {
    const calls: { args: string[]; opts: any }[] = [];
    const child = new FakeChild();
    const spawnFn: SpawnFn = (_cmd, args, opts) => {
      calls.push({ args, opts });
      return child as any;
    };
    const e = await store.create({ id: "notes-1", companion: "notes", input: {} });
    makeRunner(spawnFn).run(e);
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0].opts.cwd).toBe("/home/.claudepanion");
    const allowIdx = calls[0].args.indexOf("--allowedTools");
    expect(calls[0].args[allowIdx + 1]).toContain("mcp__claudepanion__notes_fetch");
    expect(calls[0].args[allowIdx + 1]).toContain("mcp__claudepanion__notes_get");
  });

  it("does NOT fail an entity the skill already drove to completed", async () => {
    const child = new FakeChild();
    const spawnFn: SpawnFn = () => child as any;
    const e = await store.create({ id: "notes-2", companion: "notes", input: {} });
    makeRunner(spawnFn).run(e);
    await vi.waitFor(() => expect(child.listenerCount("close")).toBe(1));

    // Simulate the headless skill having finished via MCP tools.
    await store.saveArtifact("notes", "notes-2", { summary: "s", markdown: "m" });
    child.emit("close", 0, null);
    await flush();

    const fresh = await store.get("notes", "notes-2");
    expect(fresh?.status).toBe("completed");
  });

  it("fails an entity whose process exits without reaching a terminal state", async () => {
    const child = new FakeChild();
    const spawnFn: SpawnFn = () => child as any;
    const e = await store.create({ id: "notes-3", companion: "notes", input: {} });
    makeRunner(spawnFn).run(e);
    await vi.waitFor(() => expect(child.listenerCount("close")).toBe(1));

    child.stderr.emit("data", Buffer.from("boom"));
    child.emit("close", 1, null);
    await vi.waitFor(async () => {
      const fresh = await store.get("notes", "notes-3");
      expect(fresh?.status).toBe("error");
    });
    const fresh = await store.get("notes", "notes-3");
    expect(fresh?.errorMessage).toContain("[headless]");
    expect(fresh?.errorMessage).toContain("boom");
  });

  it("fails the entity when the skill file can't be read", async () => {
    const spawnFn: SpawnFn = () => new FakeChild() as any;
    const e = await store.create({ id: "notes-4", companion: "notes", input: {} });
    const runner = makeRunner(spawnFn, {
      readSkill: async () => {
        throw new Error("ENOENT");
      },
    });
    runner.run(e);
    await vi.waitFor(async () => {
      const fresh = await store.get("notes", "notes-4");
      expect(fresh?.status).toBe("error");
    });
    const fresh = await store.get("notes", "notes-4");
    expect(fresh?.errorMessage).toContain("could not read skill");
  });

  it("honors the concurrency cap", async () => {
    const children: FakeChild[] = [];
    const spawnFn: SpawnFn = () => {
      const c = new FakeChild();
      children.push(c);
      return c as any;
    };
    const e1 = await store.create({ id: "notes-5", companion: "notes", input: {} });
    const e2 = await store.create({ id: "notes-6", companion: "notes", input: {} });
    const runner = makeRunner(spawnFn); // maxConcurrent: 1

    runner.run(e1);
    runner.run(e2);
    await vi.waitFor(() => expect(children).toHaveLength(1));
    expect(runner.activeCount()).toBe(1);

    // First finishes → the queued one starts.
    children[0].emit("close", 0, null);
    await vi.waitFor(() => expect(children).toHaveLength(2));
  });
});
