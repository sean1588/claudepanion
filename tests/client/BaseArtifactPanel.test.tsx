import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BaseArtifactPanel from "../../src/client/components/BaseArtifactPanel";

const baseEntity = {
  id: "x-123",
  companion: "x",
  status: "completed" as const,
  statusMessage: null,
  createdAt: "2026-04-25T00:00:00Z",
  updatedAt: "2026-04-25T00:00:01Z",
  input: {},
  errorMessage: null,
  errorStack: null,
  logs: [],
};

describe("BaseArtifactPanel", () => {
  it("renders summary banner when artifact has summary", () => {
    render(
      <BaseArtifactPanel entity={{ ...baseEntity, artifact: { summary: "All good" } }}>
        <div>custom-content</div>
      </BaseArtifactPanel>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.getByText("custom-content")).toBeInTheDocument();
  });

  it("renders errors section when artifact has errors", () => {
    render(
      <BaseArtifactPanel entity={{ ...baseEntity, artifact: { errors: ["one failed", "two failed"] } }}>
        <div>custom-content</div>
      </BaseArtifactPanel>
    );
    expect(screen.getByText("Notes during this run")).toBeInTheDocument();
    expect(screen.getByText("one failed")).toBeInTheDocument();
    expect(screen.getByText("two failed")).toBeInTheDocument();
  });

  it("renders only children when artifact has no summary or errors", () => {
    render(
      <BaseArtifactPanel entity={{ ...baseEntity, artifact: { somethingElse: 1 } }}>
        <div>custom-content</div>
      </BaseArtifactPanel>
    );
    expect(screen.queryByText("Notes during this run")).not.toBeInTheDocument();
    expect(screen.getByText("custom-content")).toBeInTheDocument();
  });

  it("renders only children when artifact is null", () => {
    render(
      <BaseArtifactPanel entity={{ ...baseEntity, artifact: null }}>
        <div>custom-content</div>
      </BaseArtifactPanel>
    );
    expect(screen.getByText("custom-content")).toBeInTheDocument();
  });
});
