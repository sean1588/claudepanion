import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import BuildDetail from "./build/pages/Detail";
import BuildListRow from "./build/pages/List";
import BuildForm from "./build/form";
import GithubPrReviewerDetail from "./github-pr-reviewer/pages/Detail";
import GithubPrReviewerListRow from "./github-pr-reviewer/pages/List";
import GithubPrReviewerForm from "./github-pr-reviewer/form";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;
type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "build": BuildDetail as ArtifactRenderer,
  "github-pr-reviewer": GithubPrReviewerDetail as ArtifactRenderer,
};
const listRows: Record<string, ListRow> = {
  "build": BuildListRow as ListRow,
  "github-pr-reviewer": GithubPrReviewerListRow as ListRow,
};
const forms: Record<string, CompanionForm> = {
  "build": BuildForm as CompanionForm,
  "github-pr-reviewer": GithubPrReviewerForm as CompanionForm,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }
export function getListRow(name: string): ListRow | undefined { return listRows[name]; }
export function getForm(name: string): CompanionForm | undefined { return forms[name]; }
