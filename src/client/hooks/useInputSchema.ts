import { useEffect, useState } from "react";
import type { z } from "zod";
import type { SchemaDescriptor } from "../../shared/schema-descriptor";
import { descriptorToSchema } from "../lib/descriptor-to-schema";

export interface UseInputSchemaResult {
  schema: z.ZodObject<Record<string, z.ZodTypeAny>> | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the SchemaDescriptor for a companion and rebuilds a Zod schema
 * client-side. Used by the New Entity page when the compile-time bundle
 * doesn't have the schema (i.e. for any user-local companion under
 * Option B's install model).
 */
export function useInputSchema(companion: string | undefined): UseInputSchemaResult {
  const [state, setState] = useState<UseInputSchemaResult>({ schema: null, loading: true, error: null });

  useEffect(() => {
    if (!companion) {
      setState({ schema: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ schema: null, loading: true, error: null });
    void fetch(`/api/companions/${encodeURIComponent(companion)}/input-schema`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          setState({ schema: null, loading: false, error: body.error ?? `HTTP ${r.status}` });
          return;
        }
        const desc = (await r.json()) as SchemaDescriptor;
        if (!desc.supported) {
          setState({ schema: null, loading: false, error: "InputSchema shape not supported by the server introspector" });
          return;
        }
        setState({ schema: descriptorToSchema(desc), loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ schema: null, loading: false, error: (err as Error).message });
      });
    return () => { cancelled = true; };
  }, [companion]);

  return state;
}
