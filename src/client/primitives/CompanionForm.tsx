import { useEffect, useState } from "react";
import { z } from "zod";

interface UiMeta {
  kind?: "text" | "textarea" | "password" | "select" | "searchableSelect" | "datetime" | "slider";
  options?: string[];
  optionsFrom?: string;
  argsFrom?: string[];
  group?: string;
}

function uiMetaOf(field: z.ZodTypeAny): UiMeta {
  const meta = (field as any).meta?.()?.ui;
  return meta ?? {};
}

function describeOf(field: z.ZodTypeAny): string {
  // In Zod 4, .describe() stores in .meta().description
  return (field as any).meta?.()?.description ?? "";
}

function isOptional(field: z.ZodTypeAny): boolean {
  return field.isOptional?.() ?? false;
}

interface Props<T extends z.ZodObject<any>> {
  schema: T;
  onSubmit: (input: z.infer<T>) => void | Promise<void>;
  companionSlug?: string;
}

export function CompanionForm<T extends z.ZodObject<any>>({ schema, onSubmit, companionSlug }: Props<T>) {
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      setSubmitError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitError(null);
    void onSubmit(result.data);
  };

  const renderedGroups = new Set<string>();
  const elements: JSX.Element[] = [];
  for (const [name, field] of Object.entries(shape)) {
    const g = uiMetaOf(field).group;
    if (g) {
      if (renderedGroups.has(g)) continue;
      renderedGroups.add(g);
      const groupFields = Object.entries(shape).filter(([, f]) => uiMetaOf(f).group === g);
      elements.push(
        <div key={`group-${g}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{g}</span>
          <div style={{ display: "flex", gap: 12 }}>
            {groupFields.map(([fn, ff]) => (
              <FieldRow key={fn} name={fn} field={ff} value={values[fn]} onChange={(v) => handleChange(fn, v)}
                companionSlug={companionSlug} allValues={values} />
            ))}
          </div>
        </div>
      );
    } else {
      elements.push(
        <FieldRow key={name} name={name} field={field} value={values[name]} onChange={(v) => handleChange(name, v)}
          companionSlug={companionSlug} allValues={values} />
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
      {elements}
      {submitError && <div role="alert" style={{ color: "#dc2626", fontSize: 13 }}>{submitError}</div>}
      <button type="submit" style={{ alignSelf: "flex-start", padding: "8px 14px" }}>Submit</button>
    </form>
  );
}

interface FieldRowProps {
  name: string;
  field: z.ZodTypeAny;
  value: unknown;
  onChange: (v: unknown) => void;
  companionSlug?: string;
  allValues: Record<string, unknown>;
}

function useToolOptions(companionSlug: string | undefined, optionsFrom: string | undefined, args: Record<string, unknown>) {
  const [options, setOptions] = useState<{ value: string; label: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const argsKey = JSON.stringify(args);

  useEffect(() => {
    if (!companionSlug || !optionsFrom) return;
    setError(null);
    setOptions(null);
    void fetch(`/api/tools/${companionSlug}/${optionsFrom}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) { setError(j.error ?? "fetch failed"); return; }
        const text = j.result?.content?.[0]?.text;
        if (!text) { setError("empty response"); return; }
        try {
          const parsed = JSON.parse(text);
          const arr: any[] = Array.isArray(parsed)
            ? parsed
            : Object.values(parsed).find(Array.isArray) ?? [];
          const normalized = arr.map((item) => {
            if (typeof item === "string") return { value: item, label: item };
            return { value: String(item.name ?? item.id ?? item.value), label: String(item.label ?? item.name ?? item.id ?? item.value) };
          });
          setOptions(normalized);
        } catch (_err) {
          setError("response was not JSON");
        }
      })
      .catch((err) => setError((err as Error).message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionSlug, optionsFrom, argsKey]);

  return { options, error };
}

function FieldRow({ name, field, value, onChange, companionSlug, allValues }: FieldRowProps) {
  const ui = uiMetaOf(field);
  const label = describeOf(field) || name;
  const optional = isOptional(field);
  const labelEl = (
    <span style={{ fontSize: 13 }}>
      {label}{!optional && <span style={{ color: "#dc2626" }}> *</span>}
    </span>
  );

  const inner = field instanceof z.ZodOptional ? field.unwrap() : field;
  const isString = inner instanceof z.ZodString;
  const isNumber = inner instanceof z.ZodNumber;
  const isBoolean = inner instanceof z.ZodBoolean;
  // In Zod 4, datetime checks have { type: "string", format: "datetime" } shape
  const isStringDatetime = isString && ((inner._def as any).checks ?? []).some((c: any) => c.type === "string" && c.format === "datetime");

  if (ui.kind === "select" && ui.optionsFrom) {
    const args = Object.fromEntries(
      (ui.argsFrom ?? []).map((k) => [k, allValues[k]]).filter(([, v]) => v !== undefined)
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { options, error } = useToolOptions(companionSlug, ui.optionsFrom, args);
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {labelEl}
        <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">{options ? "—" : "loading…"}</option>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {error && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
      </label>
    );
  }

  if (ui.kind === "select" && Array.isArray(ui.options)) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {labelEl}
        <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {ui.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }

  if (ui.kind === "textarea") {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {labelEl}
        <textarea rows={4} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }

  if (isStringDatetime || ui.kind === "datetime") {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {labelEl}
        <input type="datetime-local" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }

  if (isNumber) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {labelEl}
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </label>
    );
  }

  if (isBoolean) {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {labelEl}
      </label>
    );
  }

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {labelEl}
      <input type="text" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default CompanionForm;
