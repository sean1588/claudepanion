import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import BuildDetail from "./build/pages/Detail";
import BuildListRow from "./build/pages/List";
import BuildForm from "./build/form";
import GroundingDetail from "./grounding/pages/Detail";
import GroundingListRow from "./grounding/pages/List";
import GroundingForm from "./grounding/form";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;
type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "build": BuildDetail as ArtifactRenderer,
  "grounding": GroundingDetail as ArtifactRenderer,
};
const listRows: Record<string, ListRow> = {
  "build": BuildListRow as ListRow,
  "grounding": GroundingListRow as ListRow,
};
const forms: Record<string, CompanionForm> = {
  "build": BuildForm as CompanionForm,
  "grounding": GroundingForm as CompanionForm,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }
export function getListRow(name: string): ListRow | undefined { return listRows[name]; }
export function getForm(name: string): CompanionForm | undefined { return forms[name]; }
