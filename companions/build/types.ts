import { z } from "zod";
import type { BaseArtifact } from "claudepanion-host";

export const NewCompanionInput = z.object({
  mode: z.literal("new-companion"),
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "lowercase letters, digits, hyphens; starts with a letter"),
  kind: z.enum(["ui", "tool"]),
  description: z.string().min(1, "description required"),
});

export const IterateCompanionInput = z.object({
  mode: z.literal("iterate-companion"),
  target: z.string().min(1, "target required"),
  description: z.string().min(1, "description required"),
});

export const InputSchema = z.discriminatedUnion("mode", [NewCompanionInput, IterateCompanionInput]);
export type Input = z.infer<typeof InputSchema>;

// Legacy alias retained while form.tsx still imports BuildInput.
export type BuildInput = Input;

// Artifact extras (typed fields beyond markdown for list-row badges).
export interface ArtifactExtras {
  validatorPassed?: boolean;
  smokeTestPassed?: boolean;
}

export type Artifact = BaseArtifact & ArtifactExtras;

// Legacy alias.
export type BuildArtifact = Artifact;
