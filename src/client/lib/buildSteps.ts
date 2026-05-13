import type { Entity, LogEntry } from "@shared/types";

export const BUILD_STEPS = [
  "Reading prompt",
  "Designing companion shape",
  "Generating form schema",
  "Wiring MCP tools",
  "Writing skill",
  "First boot",
] as const;

export type BuildStep = (typeof BUILD_STEPS)[number];
export type StepStatus = "pending" | "active" | "done" | "failed";
export interface DerivedStep { label: BuildStep; status: StepStatus }

const PATTERNS: Array<{ step: BuildStep; needles: string[] }> = [
  { step: "Reading prompt",            needles: ["reading prompt", "loaded entity"] },
  { step: "Designing companion shape", needles: ["drafting manifest", "designing"] },
  { step: "Generating form schema",    needles: ["form schema", "writing types"] },
  { step: "Wiring MCP tools",          needles: ["writing companions/", "wiring tools", "server/tools"] },
  { step: "Writing skill",             needles: ["writing skills/"] },
  { step: "First boot",                needles: ["running validator", "validator passed"] },
];

function lineMatchesStep(line: LogEntry, step: BuildStep): boolean {
  const haystack = line.message.toLowerCase();
  const entry = PATTERNS.find((p) => p.step === step)!;
  return entry.needles.some((n) => haystack.includes(n));
}

export function deriveSteps(entity: Entity): DerivedStep[] {
  const logs = entity.logs ?? [];
  const matchedIndexes = new Set<number>();
  let latestIdx = -1;
  for (const line of logs) {
    PATTERNS.forEach((p, idx) => {
      if (lineMatchesStep(line, p.step)) {
        matchedIndexes.add(idx);
        if (idx > latestIdx) latestIdx = idx;
      }
    });
  }

  return PATTERNS.map((p, idx): DerivedStep => {
    if (!matchedIndexes.has(idx)) return { label: p.step, status: "pending" };
    if (entity.status === "completed") return { label: p.step, status: "done" };
    if (idx < latestIdx) return { label: p.step, status: "done" };
    if (entity.status === "error") return { label: p.step, status: "failed" };
    return { label: p.step, status: "active" };
  });
}
