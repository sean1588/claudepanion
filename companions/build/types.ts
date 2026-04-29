import type { BaseArtifact } from "../../src/shared/types.js";

export type BuildInput =
  | {
      mode: "new-companion";
      name: string;
      kind: "entity" | "tool";
      description: string;
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
