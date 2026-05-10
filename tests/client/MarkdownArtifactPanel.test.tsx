import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownArtifactPanel } from "../../src/client/primitives/MarkdownArtifactPanel.js";

describe("MarkdownArtifactPanel", () => {
  it("renders only the markdown body by default (parent wrapper owns summary + errors)", () => {
    render(<MarkdownArtifactPanel artifact={{
      summary: "Did the thing",
      markdown: "## Section\n\nSome **bold** text.",
      errors: ["one warning"],
    }} />);
    // Default mode: no h1, no errors callout — those belong to the wrapper.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByText(/notes during this run/i)).toBeNull();
    expect(screen.queryByText("one warning")).toBeNull();
    // Markdown body still renders.
    expect(screen.getByText("Section")).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("renders summary header and errors callout when standalone", () => {
    render(<MarkdownArtifactPanel standalone artifact={{
      summary: "Did the thing",
      markdown: "## Section",
      errors: ["one warning"],
    }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Did the thing");
    expect(screen.getByText("one warning")).toBeInTheDocument();
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
