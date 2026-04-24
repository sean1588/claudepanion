import type { ToolHandler } from "./companion-registry.js";

export type ParamType = "string" | "number" | "boolean" | "enum";

export interface ToolParam {
  name: string;
  type: ParamType;
  required?: boolean;
  enum?: string[];
  description?: string;
}

export interface ToolMeta {
  description?: string;
  params?: ToolParam[];
}

export type AnnotatedHandler = ToolHandler & { meta?: ToolMeta };

export function defineTool(handler: ToolHandler, meta: ToolMeta = {}): AnnotatedHandler {
  const annotated = handler as AnnotatedHandler;
  annotated.meta = meta;
  return annotated;
}

export function getToolMeta(handler: ToolHandler): ToolMeta | null {
  const h = handler as AnnotatedHandler;
  return h.meta ?? null;
}

export function signatureString(name: string, meta: ToolMeta | null): string {
  if (!meta?.params || meta.params.length === 0) return `${name}()`;
  const parts = meta.params.map((p) => {
    const type = p.type === "enum" ? (p.enum ?? []).map((v) => `"${v}"`).join(" | ") : p.type;
    return `${p.name}${p.required ? "" : "?"}: ${type}`;
  });
  return `${name}(${parts.join(", ")})`;
}
