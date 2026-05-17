import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpHandle } from "./mcp.js";
import type { Registry } from "./companion-registry.js";
import { bumpMcpStatus } from "./mcp-status.js";

const SERVER_NAME = "claudepanion";
const SERVER_VERSION = "0.2.0";

export interface McpHttp {
  /** Wires POST/GET/DELETE <path> onto the express app. */
  mount(app: Express, path: string): void;
  /** Closes every live session transport (call on server shutdown). */
  closeAll(): Promise<void>;
}

function jsonRpcError(code: number, message: string) {
  return { jsonrpc: "2.0", error: { code, message }, id: null };
}

/**
 * Streamable-HTTP MCP endpoint with **one transport + McpServer per session**.
 *
 * The previous implementation shared a single StreamableHTTPServerTransport for
 * the whole process. A stateful transport accepts exactly one `initialize`,
 * then rejects every other client with "Server already initialized" — so only
 * the first MCP client to connect ever worked, and Claude Code could never
 * reconnect after a restart without bouncing `claudepanion serve`.
 *
 * This follows the SDK's canonical session pattern: each `initialize` (a
 * request with no `Mcp-Session-Id`) spins up a fresh transport + server, keyed
 * by the generated session id; subsequent requests route by that header;
 * sessions are torn down on transport close / DELETE.
 *
 * `enableJsonResponse` is on: claudepanion's tools are pure request/response
 * (no server-initiated notifications), so a single JSON reply per call is
 * simpler and fully sufficient.
 */
export function createMcpHttp(mcp: McpHandle, registry: Registry): McpHttp {
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const disposers = new Map<string, () => void>();

  const buildSessionServer = (): { server: McpServer; dispose: () => void } => {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    const registered = new Set<string>();
    const registerToolDef = (name: string) => {
      if (registered.has(name)) return;
      const def = mcp.toolDefs.get(name);
      if (!def) return;
      registered.add(name);
      server.registerTool(
        name,
        { description: def.description, inputSchema: z.object(def.schema) },
        async (args) => {
          // Resolve the current def at call time so hot-reloaded handlers win.
          const current = mcp.toolDefs.get(name);
          if (!current) throw new Error(`tool ${name} no longer registered`);
          return await current.handler(args as any);
        }
      );
    };
    for (const name of mcp.toolDefs.keys()) registerToolDef(name);
    // Pick up tools from companions built mid-session.
    const unsub = registry.onChange(() => {
      for (const name of mcp.toolDefs.keys()) registerToolDef(name);
    });
    return { server, dispose: unsub };
  };

  const onPost = async (req: Request, res: Response): Promise<void> => {
    bumpMcpStatus();
    const sid = req.headers["mcp-session-id"] as string | undefined;
    let transport = sid ? transports.get(sid) : undefined;

    if (!transport) {
      if (sid) {
        res.status(404).json(jsonRpcError(-32001, "Session not found"));
        return;
      }
      if (!isInitializeRequest(req.body)) {
        res.status(400).json(jsonRpcError(-32000, "Bad Request: server not initialized (no session id, not an initialize request)"));
        return;
      }
      const { server, dispose } = buildSessionServer();
      const fresh = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (newSid) => {
          transports.set(newSid, fresh);
          disposers.set(newSid, dispose);
        },
      });
      fresh.onclose = () => {
        const id = fresh.sessionId;
        if (id) {
          transports.delete(id);
          disposers.get(id)?.();
          disposers.delete(id);
        } else {
          // Never initialized — still release the registry subscription.
          dispose();
        }
      };
      await server.connect(fresh);
      transport = fresh;
    }
    await transport.handleRequest(req, res, req.body);
  };

  const onSessionScoped = async (req: Request, res: Response): Promise<void> => {
    bumpMcpStatus();
    const sid = req.headers["mcp-session-id"] as string | undefined;
    const transport = sid ? transports.get(sid) : undefined;
    if (!transport) {
      res
        .status(sid ? 404 : 400)
        .json(jsonRpcError(sid ? -32001 : -32000, sid ? "Session not found" : "Bad Request: Mcp-Session-Id header is required"));
      return;
    }
    await transport.handleRequest(req, res);
  };

  return {
    mount(app: Express, path: string) {
      app.post(path, onPost);
      app.get(path, onSessionScoped);
      app.delete(path, onSessionScoped);
    },
    async closeAll() {
      for (const t of [...transports.values()]) {
        try {
          await t.close();
        } catch {
          /* best-effort teardown */
        }
      }
      transports.clear();
      for (const d of [...disposers.values()]) d();
      disposers.clear();
    },
  };
}
