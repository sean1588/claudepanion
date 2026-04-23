import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import ExpenseTrackerDetail from "./expense-tracker/pages/Detail";
import ExpenseTrackerListRow from "./expense-tracker/pages/List";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "expense-tracker": ExpenseTrackerDetail as ArtifactRenderer,
};

const listRows: Record<string, ListRow> = {
  "expense-tracker": ExpenseTrackerListRow as ListRow,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined {
  return artifactRenderers[name];
}

export function getListRow(name: string): ListRow | undefined {
  return listRows[name];
}
