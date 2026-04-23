import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import ExpenseTrackerDetail from "./expense-tracker/pages/Detail";
import ExpenseTrackerListRow from "./expense-tracker/pages/List";
import ExpenseTrackerForm from "./expense-tracker/form";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;
type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "expense-tracker": ExpenseTrackerDetail as ArtifactRenderer,
};
const listRows: Record<string, ListRow> = {
  "expense-tracker": ExpenseTrackerListRow as ListRow,
};
const forms: Record<string, CompanionForm> = {
  "expense-tracker": ExpenseTrackerForm as CompanionForm,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }
export function getListRow(name: string): ListRow | undefined { return listRows[name]; }
export function getForm(name: string): CompanionForm | undefined { return forms[name]; }
