import { z } from 'zod';

export type Broadcast = (event: string, data: unknown) => void;

export interface McpToolContext {
  broadcast: Broadcast;
}

export interface McpTextContent {
  type: 'text';
  text: string;
}

export interface McpSuccessResult {
  content: McpTextContent[];
  [x: string]: unknown;
}

export interface McpErrorResult {
  isError: true;
  content: McpTextContent[];
  [x: string]: unknown;
}

export type McpResult = McpSuccessResult | McpErrorResult;

export interface McpToolDefinition<TParams extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (params: TParams, context: McpToolContext) => Promise<McpResult>;
}

export type AnyMcpToolDefinition = McpToolDefinition<Record<string, unknown>>;

export function successResult(data: unknown): McpSuccessResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string): McpErrorResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
