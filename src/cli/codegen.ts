const BANNER = `// AUTO-GENERATED — do not edit; run \`claudepanion scaffold <slug>\` or \`claudepanion regenerate\`.`;

export interface CompanionDescriptor {
  slug: string;
  camelCase: string;
  hasTools?: boolean;
}

export interface ClientDescriptor extends CompanionDescriptor {
  hasForm: boolean;
  hasDetail: boolean;
  hasList: boolean;
  /** True if companions/<slug>/types.ts exists and exports `InputSchema` (ui-kind). */
  hasInputSchema: boolean;
}

export function renderCompanionIndex(d: CompanionDescriptor): string {
  return [
    BANNER,
    `import type { RegisteredCompanion } from "claudepanion-host";`,
    `import { manifest } from "./manifest.js";`,
    `import { tools } from "./server/tools.js";`,
    ``,
    `export const ${d.camelCase}: RegisteredCompanion = { manifest, tools };`,
    ``,
  ].join("\n");
}

export function renderRegistryIndex(companions: CompanionDescriptor[]): string {
  const sorted = [...companions].sort((a, b) => a.slug.localeCompare(b.slug));
  const imports = sorted
    .map((c) => `import { ${c.camelCase} } from "./${c.slug}/index.js";`)
    .join("\n");
  const list = sorted.map((c) => c.camelCase).join(", ");
  return [
    BANNER,
    `import type { RegisteredCompanion } from "claudepanion-host";`,
    imports,
    ``,
    `export const companions: RegisteredCompanion[] = [${list}];`,
    ``,
  ].join("\n");
}

export function renderClientIndex(companions: ClientDescriptor[]): string {
  const sorted = [...companions].sort((a, b) => a.slug.localeCompare(b.slug));
  const imports: string[] = [];
  const formMap: string[] = [];
  const detailMap: string[] = [];
  const listMap: string[] = [];
  const schemaMap: string[] = [];
  for (const c of sorted) {
    const Pascal = c.camelCase[0].toUpperCase() + c.camelCase.slice(1);
    if (c.hasForm) {
      imports.push(`import ${Pascal}Form from "./${c.slug}/form";`);
      formMap.push(`  "${c.slug}": ${Pascal}Form as CompanionForm,`);
    }
    if (c.hasDetail) {
      imports.push(`import ${Pascal}Detail from "./${c.slug}/pages/Detail";`);
      detailMap.push(`  "${c.slug}": ${Pascal}Detail as ArtifactRenderer,`);
    }
    if (c.hasList) {
      imports.push(`import ${Pascal}ListRow from "./${c.slug}/pages/List";`);
      listMap.push(`  "${c.slug}": ${Pascal}ListRow as ListRow,`);
    }
    if (c.hasInputSchema) {
      imports.push(`import { InputSchema as ${c.camelCase}InputSchema } from "./${c.slug}/types";`);
      schemaMap.push(`  "${c.slug}": ${c.camelCase}InputSchema,`);
    }
  }
  return [
    BANNER,
    `import type { Entity } from "../src/shared/types";`,
    `import type { ComponentType } from "react";`,
    `import type { z } from "zod";`,
    ...imports,
    ``,
    `type ArtifactRenderer = ComponentType<{ entity: Entity }>;`,
    `type ListRow = ComponentType<{ entity: Entity }>;`,
    `type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;`,
    ``,
    `const artifactRenderers: Record<string, ArtifactRenderer> = {`,
    ...detailMap,
    `};`,
    `const listRows: Record<string, ListRow> = {`,
    ...listMap,
    `};`,
    `const forms: Record<string, CompanionForm> = {`,
    ...formMap,
    `};`,
    `const inputSchemas: Record<string, z.ZodTypeAny> = {`,
    ...schemaMap,
    `};`,
    ``,
    `export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }`,
    `export function getListRow(name: string): ListRow | undefined { return listRows[name]; }`,
    `export function getForm(name: string): CompanionForm | undefined { return forms[name]; }`,
    `export function getInputSchema(name: string): z.ZodTypeAny | undefined { return inputSchemas[name]; }`,
    ``,
  ].join("\n");
}

export function slugToCamelCase(slug: string): string {
  return slug.replace(/-([a-z])/g, (_m, ch) => ch.toUpperCase());
}
