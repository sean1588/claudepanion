// AUTO-GENERATED — do not edit; run `claudepanion scaffold <slug>` or `claudepanion regenerate`.
import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import BuildForm from "./build/form";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;
type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
};
const listRows: Record<string, ListRow> = {
};
const forms: Record<string, CompanionForm> = {
  "build": BuildForm as CompanionForm,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }
export function getListRow(name: string): ListRow | undefined { return listRows[name]; }
export function getForm(name: string): CompanionForm | undefined { return forms[name]; }
