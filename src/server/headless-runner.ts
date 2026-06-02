import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Entity } from "../shared/types.js";
import type { EntityStore } from "./entity-store.js";
import type { Registry, RegisteredCompanion } from "./companion-registry.js";
import { entityToolNames } from "./mcp.js";

/** The MCP server name companions register under (see `.mcp.json` / mcp-config.ts). */
const MCP_SERVER_NAME = "claudepanion";

const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
/** Cap on captured stdout/stderr kept for crash diagnostics. */
const OUTPUT_CAP = 20_000;

export type SpawnFn = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: ["ignore", "pipe", "pipe"] }
) => ChildProcess;

export interface HeadlessRunnerDeps {
  store: EntityStore;
  registry: Registry;
  /** Runtime root (`~/.claudepanion`) — holds `.mcp.json` and `skills/`. */
  homeRoot: string;
  /** Override the spawner (tests). */
  spawnFn?: SpawnFn;
  /** Override the claude binary (default: "claude"). */
  claudeBin?: string;
  /** Read a companion's SKILL.md (tests inject; default reads from disk). */
  readSkill?: (slug: string) => Promise<string>;
  maxConcurrent?: number;
  timeoutMs?: number;
}

export interface HeadlessRunner {
  /** Queue an entity for a headless run. Fire-and-forget; respects the concurrency cap. */
  run(entity: Entity): void;
  /** Kill a running (or drop a queued) headless run. Returns false if not found. */
  cancel(companion: string, id: string): boolean;
  /** Kill every in-flight run — used on shutdown. */
  cancelAll(): void;
  activeCount(): number;
}

// ─── Pure builders (unit-tested directly) ────────────────────────────────────

/**
 * The `--allowedTools` allowlist for a headless run: ONLY this companion's MCP
 * tools (lifecycle + its own proxy tools), qualified as `mcp__<server>__<tool>`.
 * Bounds the run to the companion's sanctioned surface — no Bash, no Write, no
 * other companion's tools. Never includes a skip-permissions escape.
 */
export function companionAllowedTools(c: RegisteredCompanion): string[] {
  const lifecycle = c.manifest.kind === "ui" ? entityToolNames(c.manifest.name) : [];
  const proxy = c.tools.map((t) => t.name);
  return [...lifecycle, ...proxy].map((name) => `mcp__${MCP_SERVER_NAME}__${name}`);
}

/** The user prompt handed to `claude -p` — mirrors what the slash command triggers. */
export function buildHeadlessPrompt(slug: string, entityId: string): string {
  return [
    `You are running headlessly (there is NO human in this session) to process a claudepanion entity.`,
    `Follow the appended skill instructions exactly.`,
    ``,
    `Companion: ${slug}`,
    `Entity ID: ${entityId}`,
    ``,
    `Start by loading the entity with the \`${slug}_get\` MCP tool, do the work, and drive every status/log/artifact update through the claudepanion MCP tools.`,
    `Because no human can confirm anything: never pause to wait for confirmation. If a skill step would normally ask the user to confirm an action, proceed with the safest available default and record what you did — and anything you skipped — in the artifact's notes.`,
    `When you finish you MUST have called the save_artifact tool and set status to "completed", or called the fail tool on an unrecoverable error.`,
  ].join("\n");
}

/**
 * The argv for the headless `claude` invocation. Deliberately omits
 * `--dangerously-skip-permissions`: tools outside the allowlist are denied
 * (loud, safe) rather than auto-run.
 */
export function buildClaudeArgs(opts: {
  prompt: string;
  skillInstructions: string;
  mcpConfigPath: string;
  allowedTools: string[];
}): string[] {
  return [
    "-p",
    opts.prompt,
    "--append-system-prompt",
    opts.skillInstructions,
    "--mcp-config",
    opts.mcpConfigPath,
    "--strict-mcp-config",
    "--allowedTools",
    opts.allowedTools.join(","),
  ];
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export function createHeadlessRunner(deps: HeadlessRunnerDeps): HeadlessRunner {
  const spawnFn = deps.spawnFn ?? (nodeSpawn as unknown as SpawnFn);
  const claudeBin = deps.claudeBin ?? "claude";
  const maxConcurrent = deps.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const readSkill =
    deps.readSkill ??
    ((slug: string) => readFile(join(deps.homeRoot, "skills", `${slug}-companion`, "SKILL.md"), "utf8"));

  const queue: Entity[] = [];
  // value === null means the slot is reserved while we await the async skill read.
  const active = new Map<string, ChildProcess | null>();
  const cancelledWhileStarting = new Set<string>();

  const key = (companion: string, id: string) => `${companion}/${id}`;

  function pump(): void {
    while (active.size < maxConcurrent && queue.length > 0) {
      const entity = queue.shift()!;
      active.set(key(entity.companion, entity.id), null); // reserve synchronously
      void start(entity);
    }
  }

  async function finish(k: string): Promise<void> {
    active.delete(k);
    cancelledWhileStarting.delete(k);
    pump();
  }

  async function start(entity: Entity): Promise<void> {
    const k = key(entity.companion, entity.id);
    const c = deps.registry.get(entity.companion);
    if (!c) {
      await deps.store.fail(entity.companion, entity.id, `[headless] companion not registered: ${entity.companion}`);
      return finish(k);
    }

    let skill: string;
    try {
      skill = await readSkill(entity.companion);
    } catch (err) {
      await deps.store.fail(
        entity.companion,
        entity.id,
        `[headless] could not read skill for ${entity.companion}: ${(err as Error).message}`
      );
      return finish(k);
    }

    const args = buildClaudeArgs({
      prompt: buildHeadlessPrompt(entity.companion, entity.id),
      skillInstructions: skill,
      mcpConfigPath: join(deps.homeRoot, ".mcp.json"),
      allowedTools: companionAllowedTools(c),
    });

    let child: ChildProcess;
    try {
      child = spawnFn(claudeBin, args, { cwd: deps.homeRoot, stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      await deps.store.fail(entity.companion, entity.id, `[headless] failed to spawn claude: ${(err as Error).message}`);
      return finish(k);
    }

    // Cancelled during the async skill read, before the process existed.
    if (cancelledWhileStarting.has(k)) {
      child.kill("SIGTERM");
    }
    active.set(k, child);

    let output = "";
    const capture = (d: Buffer) => {
      output += d.toString();
      if (output.length > OUTPUT_CAP) output = output.slice(-OUTPUT_CAP);
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("error", async (err: Error) => {
      clearTimeout(timer);
      await deps.store.fail(entity.companion, entity.id, `[headless] claude process error: ${err.message}`);
      await finish(k);
    });

    child.on("close", async (code: number | null, signal: string | null) => {
      clearTimeout(timer);
      // The skill drives status through MCP. Only mark a failure if the process
      // ended without the entity reaching a terminal state.
      try {
        const fresh = await deps.store.get(entity.companion, entity.id);
        const terminal = fresh != null && (fresh.status === "completed" || fresh.status === "error");
        if (!terminal) {
          const reason = timedOut
            ? `timed out after ${Math.round(timeoutMs / 1000)}s`
            : `exited (code ${code ?? "null"}${signal ? `, signal ${signal}` : ""}) without completing`;
          await deps.store.fail(
            entity.companion,
            entity.id,
            `[headless] claude ${reason}.${output ? ` Output tail:\n${output.slice(-2000)}` : ""}`
          );
        }
      } finally {
        await finish(k);
      }
    });
  }

  return {
    run(entity) {
      queue.push(entity);
      pump();
    },
    cancel(companion, id) {
      const k = key(companion, id);
      if (active.has(k)) {
        const child = active.get(k);
        if (child) child.kill("SIGTERM");
        else cancelledWhileStarting.add(k); // reserved but not yet spawned
        return true;
      }
      const idx = queue.findIndex((e) => e.companion === companion && e.id === id);
      if (idx >= 0) {
        queue.splice(idx, 1);
        return true;
      }
      return false;
    },
    cancelAll() {
      queue.length = 0;
      for (const child of active.values()) child?.kill("SIGTERM");
    },
    activeCount() {
      return active.size;
    },
  };
}
