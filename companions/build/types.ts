import type { BaseArtifact } from "../../src/shared/types.js";

export type BuildInput =
  | {
      mode: "new-companion";
      name: string;
      kind: "entity" | "tool";
      description: string;
      /** Slug of the BuildExample that prefilled this submission, if any. Drives skillTemplate lookup during scaffolding. */
      example?: string;
    }
  | {
      mode: "iterate-companion";
      target: string;
      description: string;
    };

export interface BuildArtifact extends BaseArtifact {
  filesCreated: string[];
  filesModified: string[];
  /** Required for Build runs (overrides BaseArtifact's optional summary). */
  summary: string;
  validatorPassed: boolean;
  smokeTestPassed: boolean;
}
