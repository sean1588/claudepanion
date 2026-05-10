import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownArtifactPanel } from "../../src/client/primitives/MarkdownArtifactPanel.js";

describe("MarkdownArtifactPanel", () => {
  it("renders summary as h1, errors callout, and markdown body", () => {
    render(<MarkdownArtifactPanel artifact={{
      summary: "Did the thing",
      markdown: "## Section\n\nSome **bold** text.",
      errors: ["one warning"],
    }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Did the thing");
    expect(screen.getByText("one warning")).toBeInTheDocument();
    expect(screen.getByText("Section")).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("omits the errors callout when errors is empty/undefined", () => {
    render(<MarkdownArtifactPanel artifact={{ summary: "ok", markdown: "body" }} />);
    expect(screen.queryByText(/notes during this run/i)).not.toBeInTheDocument();
  });

  it("renders a placeholder when markdown is empty", () => {
    render(<MarkdownArtifactPanel artifact={{ summary: "ok", markdown: "" }} />);
    expect(screen.getByText(/no markdown report/i)).toBeInTheDocument();
  });
});
