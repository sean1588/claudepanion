import type { Router } from 'express';
import type { ZodRawShape, z } from 'zod';

export type Broadcast = (event: string, data: unknown) => void;

export interface CompanionStore<T> {
  read(): Promise<T>;
  write(data: T): Promise<void>;
}

export interface CompanionContext {
  slug: string;
  broadcast: Broadcast;
  store: CompanionStore<unknown>;
  log(...args: unknown[]): void;
}

export interface McpToolDefinition<TParams = Record<string, unknown>> {
  name: string;
  description: string;
  schema: ZodRawShape;
  handler(
    params: TParams,
    ctx: CompanionContext,
  ): Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
}

export interface CompanionManifest {
  slug: string;
  name: string;
  description: string;
  icon?: string;
}

export interface Companion {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  tools: McpToolDefinition[];
  renderPage(ctx: CompanionContext): Promise<string> | string;
  router: Router | null;
}

export function successResult(data: unknown): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return { content: [{ type: 'text', text: message }], isError: true };
}
