import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import type { Entity, EntityStatus } from "../shared/types.js";

export interface CreateEntityArgs {
  id: string;
  companion: string;
  input: unknown;
}

export interface EntityStore {
  create(args: CreateEntityArgs): Promise<Entity>;
  get(companion: string, id: string): Promise<Entity | null>;
  list(companion: string): Promise<Entity[]>;
  updateStatus(companion: string, id: string, status: EntityStatus, statusMessage?: string | null): Promise<void>;
  appendLog(companion: string, id: string, message: string, level?: "info" | "warn" | "error"): Promise<void>;
  saveArtifact(companion: string, id: string, artifact: unknown): Promise<void>;
  fail(companion: string, id: string, errorMessage: string, errorStack?: string): Promise<void>;
  continueWith(companion: string, id: string, continuation: string): Promise<void>;
}

export function createEntityStore(root: string): EntityStore {
  const companionDir = (c: string) => join(root, c);
  const entityPath = (c: string, id: string) => join(companionDir(c), `${id}.json`);

  async function writeAtomic(path: string, data: unknown): Promise<void> {
    await fs.mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, path);
  }

  async function readEntity(c: string, id: string): Promise<Entity | null> {
    try {
      const raw = await fs.readFile(entityPath(c, id), "utf8");
      return JSON.parse(raw) as Entity;
    } catch (err: any) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  async function mutate(c: string, id: string, fn: (e: Entity) => Entity): Promise<void> {
    const current = await readEntity(c, id);
    if (!current) throw new Error(`entity not found: ${c}/${id}`);
    const next = { ...fn(current), updatedAt: new Date().toISOString() };
    await writeAtomic(entityPath(c, id), next);
  }

  return {
    async create({ id, companion, input }) {
      const now = new Date().toISOString();
      const entity: Entity = {
        id,
        companion,
        status: "pending",
        statusMessage: null,
        createdAt: now,
        updatedAt: now,
        input,
        artifact: null,
        errorMessage: null,
        errorStack: null,
        logs: [],
      };
      await writeAtomic(entityPath(companion, id), entity);
      return entity;
    },

    async get(companion, id) {
      return readEntity(companion, id);
    },

    async list(companion) {
      try {
        const names = await fs.readdir(companionDir(companion));
        const files = names.filter((n) => n.endsWith(".json"));
        const entities = await Promise.all(
          files.map(async (n) => {
            const raw = await fs.readFile(join(companionDir(companion), n), "utf8");
            return JSON.parse(raw) as Entity;
          })
        );
        return entities.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      } catch (err: any) {
        if (err.code === "ENOENT") return [];
        throw err;
      }
    },

    async updateStatus(companion, id, status, statusMessage = null) {
      await mutate(companion, id, (e) => ({ ...e, status, statusMessage }));
    },

    async appendLog(companion, id, message, level = "info") {
      await mutate(companion, id, (e) => ({
        ...e,
        logs: [...e.logs, { timestamp: new Date().toISOString(), level, message }],
      }));
    },

    async saveArtifact(companion, id, artifact) {
      await mutate(companion, id, (e) => ({ ...e, artifact, status: "completed", statusMessage: null }));
    },

    async fail(companion, id, errorMessage, errorStack) {
      await mutate(companion, id, (e) => ({
        ...e,
        status: "error",
        errorMessage,
        errorStack: errorStack ?? null,
      }));
    },

    async continueWith(companion, id, continuation) {
      await mutate(companion, id, (e) => ({
        ...e,
        status: "pending",
        statusMessage: null,
        errorMessage: null,
        errorStack: null,
        input: {
          ...(e.input as object),
          continuation,
          previousArtifact: e.artifact,
        },
        artifact: null,
        logs: [],
      }));
    },
  };
}
