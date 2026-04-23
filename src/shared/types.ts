export type EntityStatus = "pending" | "running" | "completed" | "error";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface Entity<Input = unknown, Artifact = unknown> {
  id: string;
  companion: string;
  status: EntityStatus;
  statusMessage: string | null;
  createdAt: string;
  updatedAt: string;
  input: Input;
  artifact: Artifact | null;
  errorMessage: string | null;
  errorStack: string | null;
  logs: LogEntry[];
}

export type CompanionKind = "entity" | "tool";

export interface Manifest {
  name: string;
  kind: CompanionKind;
  displayName: string;
  icon: string;
  description: string;
  contractVersion: string;
  version: string;
}
