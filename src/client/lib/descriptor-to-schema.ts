import { z } from "zod";
import type { SchemaDescriptor, FieldDescriptor } from "../../shared/schema-descriptor";

/**
 * Rebuild a minimal Zod schema from a server-supplied SchemaDescriptor.
 *
 * The output is a `z.object(...)` whose fields carry the same description and
 * `.meta({ ui })` hints as the original, plus the validators we know how to
 * round-trip (min/max, datetime). CompanionForm reads these via its existing
 * Zod introspection — no changes needed in the form itself.
 */
export function descriptorToSchema(desc: SchemaDescriptor): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!desc.supported) return z.object({});
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of desc.fields) {
    shape[f.name] = fieldToZod(f);
  }
  return z.object(shape);
}

function fieldToZod(f: FieldDescriptor): z.ZodTypeAny {
  let z_: z.ZodTypeAny;
  if (f.type === "string") {
    let s = z.string();
    if (f.validators?.minLength !== undefined) s = s.min(f.validators.minLength);
    if (f.validators?.maxLength !== undefined) s = s.max(f.validators.maxLength);
    if (f.validators?.datetime) s = s.datetime();
    z_ = s;
  } else if (f.type === "number") {
    let n = z.number();
    if (f.validators?.min !== undefined) n = n.min(f.validators.min);
    if (f.validators?.max !== undefined) n = n.max(f.validators.max);
    z_ = n;
  } else {
    z_ = z.boolean();
  }
  if (f.description) z_ = z_.describe(f.description);
  if (f.ui) z_ = z_.meta({ ui: f.ui });
  if (f.optional) z_ = z_.optional();
  return z_;
}
