import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import ExpenseTrackerDetail from "./expense-tracker/pages/Detail";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;

const renderers: Record<string, ArtifactRenderer> = {
  "expense-tracker": ExpenseTrackerDetail as ArtifactRenderer,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined {
  return renderers[name];
}
