import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DefaultListRow } from "../../src/client/primitives/DefaultListRow.js";
import type { Entity } from "../../src/shared/types.js";

const baseEntity: Entity = {
  id: "abc-123",
  companion: "x",
  status: "completed",
  statusMessage: null,
  createdAt: "2026-05-09T00:00:00Z",
  updatedAt: "2026-05-09T01:00:00Z",
  input: {},
  artifact: { summary: "Done", markdown: "..." },
  errorMessage: null,
  errorStack: null,
  logs: [],
};

describe("DefaultListRow", () => {
  it("renders status, id, summary", () => {
    render(<DefaultListRow entity={baseEntity} />);
    expect(screen.getByText("abc-123")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("falls back to <pending> when no artifact", () => {
    render(<DefaultListRow entity={{ ...baseEntity, status: "pending", artifact: null }} />);
    expect(screen.getByText("<pending>")).toBeInTheDocument();
  });
});
