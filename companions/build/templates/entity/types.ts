import type { BaseArtifact } from "../../src/shared/types.js";

// TODO(build): replace these placeholder shapes with the real Input and Artifact
// per scaffold-spec §16b. Input fields capture WHERE/WHICH (e.g. repo + PR number,
// AWS profile + log group, Linear team + filter) — not "paste your text here."
// Artifact fields are the domain fields Detail.tsx will render. BaseArtifact already
// provides optional `summary?: string` and `errors?: string[]`.

export interface __PASCAL__Input {
  // TODO(build): add real input fields per §16b.3
}

export interface __PASCAL__Artifact extends BaseArtifact {
  // TODO(build): add real artifact fields per §16b.4
}
