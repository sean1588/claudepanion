import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import BuildDetail from "./build/pages/Detail";
import BuildListRow from "./build/pages/List";
import BuildForm from "./build/form";
import PrReviewerDetail from "./pr-reviewer/pages/Detail";
import PrReviewerListRow from "./pr-reviewer/pages/List";
import PrReviewerForm from "./pr-reviewer/form";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;
type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "build": BuildDetail as ArtifactRenderer,
  "pr-reviewer": PrReviewerDetail as ArtifactRenderer,
};
const listRows: Record<string, ListRow> = {
  "build": BuildListRow as ListRow,
  "pr-reviewer": PrReviewerListRow as ListRow,
};
const forms: Record<string, CompanionForm> = {
  "build": BuildForm as CompanionForm,
  "pr-reviewer": PrReviewerForm as CompanionForm,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }
export function getListRow(name: string): ListRow | undefined { return listRows[name]; }
export function getForm(name: string): CompanionForm | undefined { return forms[name]; }
