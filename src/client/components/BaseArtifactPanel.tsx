import type { ReactNode } from "react";
import type { Entity } from "@shared/types";

export interface BaseArtifactPanelProps {
  entity: Entity;
  children: ReactNode;
}

interface PartialBase {
  summary?: unknown;
  errors?: unknown;
}

export default function BaseArtifactPanel({ entity, children }: BaseArtifactPanelProps) {
  const a = (entity.artifact ?? {}) as PartialBase;
  const summary = typeof a.summary === "string" && a.summary.trim() ? a.summary : null;
  const errors = Array.isArray(a.errors) ? a.errors.filter((e): e is string => typeof e === "string") : [];

  return (
    <>
      {summary && (
        <div className="artifact-summary-banner">
          {summary}
        </div>
      )}
      {children}
      {errors.length > 0 && (
        <div className="artifact-errors">
          <div className="artifact-errors-header">Notes during this run</div>
          <ul className="artifact-errors-list">
            {errors.map((e, i) => (<li key={i}>{e}</li>))}
          </ul>
        </div>
      )}
    </>
  );
}
