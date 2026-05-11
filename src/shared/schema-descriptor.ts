/**
 * JSON-serializable description of a companion's InputSchema.
 *
 * The framework's React bundle is built before user companions exist, so
 * compile-time imports can't see user-local schemas. The server inspects each
 * companion's Zod schema at request time and serves this descriptor; the
 * client rebuilds a minimal Zod schema from it for form rendering and submit
 * validation.
 *
 * Covered today: ZodString / ZodNumber / ZodBoolean leaf fields with the
 * common modifiers (optional, default, min/max, string datetime). More
 * exotic types (unions, arrays, nested objects) are not yet supported; the
 * introspector returns an empty descriptor for those and the host pages fall
 * back to a "no form available" placeholder.
 */
export type FieldType = "string" | "number" | "boolean";

export interface FieldUiMeta {
  kind?: "text" | "textarea" | "password" | "select" | "searchableSelect" | "datetime" | "slider";
  options?: string[];
  optionsFrom?: string;
  argsFrom?: string[];
  group?: string;
}

export interface FieldValidators {
  /** ZodNumber min */
  min?: number;
  /** ZodNumber max */
  max?: number;
  /** ZodString min length */
  minLength?: number;
  /** ZodString max length */
  maxLength?: number;
  /** ZodString().datetime() */
  datetime?: boolean;
}

export interface FieldDescriptor {
  name: string;
  type: FieldType;
  optional: boolean;
  description?: string;
  ui?: FieldUiMeta;
  validators?: FieldValidators;
}

export interface SchemaDescriptor {
  fields: FieldDescriptor[];
  /** True iff the schema was a ZodObject we could introspect. False for unions, etc. */
  supported: boolean;
}
