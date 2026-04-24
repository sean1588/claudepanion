import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GroundingForm from "../../companions/grounding/form";
import GroundingListRow from "../../companions/grounding/pages/List";
import GroundingDetail from "../../companions/grounding/pages/Detail";
import type { Entity } from "../../src/shared/types";
import type { GroundingInput, GroundingArtifact } from "../../companions/grounding/types";

// react-markdown is ESM-only; mock it so jsdom tests don't need a full transformer setup.
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => {
    // Very minimal markdown: render headings and paragraphs
    const lines = children.split("\n");
    return (
      <div>
        {lines.map((line, i) => {
          const h2 = line.match(/^##\s+(.+)/);
          const h3 = line.match(/^###\s+(.+)/);
          if (h2) return <h2 key={i}>{h2[1]}</h2>;
          if (h3) return <h3 key={i}>{h3[1]}</h3>;
          if (line.trim()) return <p key={i}>{line}</p>;
          return null;
        })}
      </div>
    );
  },
}));

function mkEntity(input: GroundingInput, artifact?: GroundingArtifact): Entity<GroundingInput, GroundingArtifact> {
  return {
    id: "grounding-abc",
    companion: "grounding",
    status: artifact ? "completed" : "pending",
    statusMessage: null,
    createdAt: "2026-04-24T00:00:00Z",
    updatedAt: "2026-04-24T00:00:00Z",
    input,
    artifact: artifact ?? null,
    errorMessage: null,
    errorStack: null,
    logs: [],
  };
}

describe("GroundingForm", () => {
  it("renders the focus area textarea with correct placeholder", () => {
    render(<MemoryRouter><GroundingForm onSubmit={() => {}} /></MemoryRouter>);
    const ta = screen.getByRole("textbox");
    expect(ta).toBeInTheDocument();
    expect(ta).toHaveAttribute("placeholder", expect.stringContaining("plugin system"));
  });

  it("submits with focus undefined when textarea is empty", async () => {
    let submitted: GroundingInput | null = null;
    render(<MemoryRouter><GroundingForm onSubmit={(i) => { submitted = i; }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    await new Promise((r) => setTimeout(r, 10));
    expect(submitted).not.toBeNull();
    expect((submitted as GroundingInput).focus).toBeUndefined();
  });

  it("submits with focus set when textarea has text", async () => {
    let submitted: GroundingInput | null = null;
    render(<MemoryRouter><GroundingForm onSubmit={(i) => { submitted = i; }} /></MemoryRouter>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "plugin system" } });
    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    await new Promise((r) => setTimeout(r, 10));
    expect((submitted as GroundingInput).focus).toBe("plugin system");
  });
});

describe("GroundingListRow", () => {
  it("shows 'Full overview' when focus is empty", () => {
    render(<GroundingListRow entity={mkEntity({})} />);
    expect(screen.getByText("Full overview")).toBeInTheDocument();
  });

  it("shows focus text when focus is set", () => {
    render(<GroundingListRow entity={mkEntity({ focus: "plugin system" })} />);
    expect(screen.getByText("plugin system")).toBeInTheDocument();
  });
});

describe("GroundingDetail", () => {
  it("renders null when no artifact", () => {
    const { container } = render(<GroundingDetail entity={mkEntity({})} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the briefing markdown via react-markdown", () => {
    render(<GroundingDetail entity={mkEntity({}, { briefing: "## Thesis\n\nClaudepanion is..." })} />);
    expect(screen.getByRole("heading", { name: "Thesis" })).toBeInTheDocument();
    expect(screen.getByText(/Claudepanion is/)).toBeInTheDocument();
  });
});
