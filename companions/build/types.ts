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

export interface BuildArtifact {
  filesCreated: string[];
  filesModified: string[];
  summary: string;
  validatorPassed: boolean;
  smokeTestPassed: boolean;
}
