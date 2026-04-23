import type { EntityStatus } from "@shared/types";

export default function StatusPill({ status }: { status: EntityStatus }) {
  return <span className={`status-pill ${status}`}>{status}</span>;
}
