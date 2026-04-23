import { randomBytes } from "node:crypto";

export function generateEntityId(companion: string): string {
  const suffix = randomBytes(3).toString("hex");
  return `${companion}-${suffix}`;
}
