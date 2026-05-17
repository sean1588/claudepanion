import type { Entity, Manifest } from "@shared/types";

export type MountRemedy = "restart" | "rebuild" | "fix-code";

export interface MountFailure {
  slug: string;
  stage: "import-threw" | "import-empty" | "dist-stale" | "validation-failed";
  message: string;
  remedy: MountRemedy;
  at: string;
}

export interface MountStatus {
  mounted: boolean;
  failure: MountFailure | null;
}

export async function fetchCompanions(): Promise<Manifest[]> {
  const res = await fetch("/api/companions");
  if (!res.ok) throw new Error(`GET /api/companions failed: ${res.status}`);
  return res.json();
}

export async function fetchMountStatus(slug: string): Promise<MountStatus> {
  const res = await fetch(`/api/companions/${encodeURIComponent(slug)}/mount-status`);
  if (!res.ok) throw new Error(`GET mount-status failed: ${res.status}`);
  return res.json();
}

export async function fetchEntity(companion: string, id: string): Promise<Entity> {
  const res = await fetch(`/api/entities/${encodeURIComponent(id)}?companion=${encodeURIComponent(companion)}`);
  if (!res.ok) throw new Error(`GET /api/entities/${id} failed: ${res.status}`);
  return res.json();
}

export async function fetchEntities(companion: string): Promise<Entity[]> {
  const res = await fetch(`/api/entities?companion=${encodeURIComponent(companion)}`);
  if (!res.ok) throw new Error(`GET /api/entities failed: ${res.status}`);
  return res.json();
}

export async function createEntity(companion: string, input: unknown): Promise<Entity> {
  const res = await fetch("/api/entities", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companion, input }),
  });
  if (!res.ok) throw new Error(`POST /api/entities failed: ${res.status}`);
  return res.json();
}

export async function deleteCompanion(name: string): Promise<void> {
  const res = await fetch(`/api/companions/${encodeURIComponent(name)}`, { method: "DELETE" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error ?? `DELETE /api/companions/${name} failed: ${res.status}`);
  }
}

export async function continueEntity(companion: string, id: string, continuation: string): Promise<Entity> {
  const res = await fetch(`/api/entities/${encodeURIComponent(id)}/continue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companion, continuation }),
  });
  if (!res.ok) throw new Error(`POST continue failed: ${res.status}`);
  return res.json();
}
