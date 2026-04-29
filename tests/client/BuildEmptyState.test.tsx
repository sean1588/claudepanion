import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BuildEmptyState from "../../src/client/pages/BuildEmptyState";
import { buildExamples } from "../../companions/build/examples";

function renderAt(path = "/c/build") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/c/build" element={<BuildEmptyState />} />
        <Route path="/c/build/new" element={<div data-testid="new-page" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BuildEmptyState", () => {
  it("renders the first-person welcome block", () => {
    renderAt();
    expect(screen.getByText(/I'm Build — your first companion/i)).toBeInTheDocument();
  });

  it("renders all 3 example chips by displayName", () => {
    renderAt();
    for (const ex of buildExamples) {
      expect(screen.getByText(ex.displayName)).toBeInTheDocument();
    }
  });

  it("renders the '+ New companion' button", () => {
    renderAt();
    expect(screen.getByRole("button", { name: /\+ New companion/i })).toBeInTheDocument();
  });

  it("navigates to /c/build/new?example=<slug> on chip click", async () => {
    renderAt();
    const chip = screen.getByText(buildExamples[0].displayName).closest('[data-testid="chip"]');
    expect(chip).not.toBeNull();
    fireEvent.click(chip!);
    expect(await screen.findByTestId("new-page")).toBeInTheDocument();
  });

  it("navigates to /c/build/new with no query on '+ New companion' click", async () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /\+ New companion/i }));
    expect(await screen.findByTestId("new-page")).toBeInTheDocument();
  });
});
