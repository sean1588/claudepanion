import { z } from "zod";
import type { SchemaDescriptor, FieldDescriptor, FieldType, FieldValidators, FieldUiMeta } from "../shared/schema-descriptor.js";

/**
 * Walk a Zod schema and produce a JSON-safe SchemaDescriptor. Only ZodObject
 * schemas are introspectable; everything else returns `supported: false`.
 */
export function schemaToDescriptor(schema: unknown): SchemaDescriptor {
  if (!schema || typeof schema !== "object" || !("shape" in (schema as object))) {
    return { fields: [], supported: false };
  }
  const shape = (schema as { shape: Record<string, z.ZodTypeAny> }).shape;
  const fields: FieldDescriptor[] = [];
  for (const [name, field] of Object.entries(shape)) {
    const desc = introspectField(name, field);
    if (desc) fields.push(desc);
  }
  return { fields, supported: true };
}

function introspectField(name: string, field: z.ZodTypeAny): FieldDescriptor | null {
  let optional = field.isOptional?.() ?? false;
  let inner: z.ZodTypeAny = field;

  // Unwrap ZodOptional / ZodDefault / ZodNullable so we can read the leaf
  // type's checks. Zod 4 uses lowercase `_def.type` discriminators.
  for (let i = 0; i < 5; i++) {
    const def = (inner as unknown as { _def?: { type?: string; innerType?: z.ZodTypeAny } })._def;
    if (!def) break;
    if (def.type === "optional" || def.type === "nullable" || def.type === "default") {
      if (!def.innerType) break;
      inner = def.innerType;
      optional = true;
    } else {
      break;
    }
  }

  // Read metadata off the *outer* field (Zod 4 stores meta on the wrapper, not the inner).
  const meta = ((field as unknown as { meta?: () => { ui?: FieldUiMeta; description?: string } }).meta?.()) ?? {};
  const ui: FieldUiMeta | undefined = meta.ui;
  const description: string = meta.description ?? "";

  let type: FieldType;
  const validators: FieldValidators = {};

  // Zod 4 stores checks as wrapper objects with the actual shape under `_zod.def`.
  // String length / number range have completely different `check` discriminators.
  const rawChecks = ((inner as unknown as { _def: { checks?: Array<{ _zod?: { def?: Record<string, unknown> } }> } })._def.checks) ?? [];
  const checks = rawChecks.map((c) => c._zod?.def).filter((d): d is Record<string, unknown> => !!d);

  if (inner instanceof z.ZodString) {
    type = "string";
    for (const check of checks) {
      if (check.check === "string_format" && check.format === "datetime") validators.datetime = true;
      else if (check.check === "min_length" && typeof check.minimum === "number") validators.minLength = check.minimum;
      else if (check.check === "max_length" && typeof check.maximum === "number") validators.maxLength = check.maximum;
    }
  } else if (inner instanceof z.ZodNumber) {
    type = "number";
    for (const check of checks) {
      if (check.check === "greater_than" && typeof check.value === "number") validators.min = check.value;
      else if (check.check === "less_than" && typeof check.value === "number") validators.max = check.value;
    }
  } else if (inner instanceof z.ZodBoolean) {
    type = "boolean";
  } else {
    // Unsupported leaf (arrays, nested objects, enums, etc.). Skip the field.
    // The client will see it missing from the descriptor — better than rendering wrong.
    return null;
  }

  return {
    name,
    type,
    optional,
    ...(description ? { description } : {}),
    ...(ui ? { ui } : {}),
    ...(Object.keys(validators).length > 0 ? { validators } : {}),
  };
}
