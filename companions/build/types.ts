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

export interface BuildArtifact {
  filesCreated: string[];
  filesModified: string[];
  summary: string;
  validatorPassed: boolean;
  smokeTestPassed: boolean;
}
