import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import BuildHome from "../../src/client/pages/BuildHome";

const mockEntities = vi.fn();
vi.mock("../../src/client/api", () => ({
  fetchEntities: (...args: unknown[]) => mockEntities(...args),
}));

describe("BuildHome", () => {
  it("renders the hero and two start-mode cards", async () => {
    mockEntities.mockResolvedValueOnce([]);
    render(<MemoryRouter><BuildHome /></MemoryRouter>);
    expect(await screen.findByText(/Hi, I'm Build/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scaffold from scratch/i })).toHaveAttribute("href", "/c/build/new");
    expect(screen.getByRole("link", { name: /evolve a companion/i })).toHaveAttribute("href", "/c/build/new?mode=iterate");
  });

  it("shows empty state when there are no past builds", async () => {
    mockEntities.mockResolvedValueOnce([]);
    render(<MemoryRouter><BuildHome /></MemoryRouter>);
    expect(await screen.findByText(/No builds yet/i)).toBeInTheDocument();
  });

  it("shows recent builds when entities exist", async () => {
    mockEntities.mockResolvedValueOnce([
      { id: "build-1", status: "completed", input: { description: "PR reviewer" }, createdAt: "2026-05-10T10:00:00Z", updatedAt: "2026-05-10T10:05:00Z" },
    ]);
    render(<MemoryRouter><BuildHome /></MemoryRouter>);
    expect(await screen.findByText(/PR reviewer/i)).toBeInTheDocument();
  });

  it("suggestion cards link with ?example=<slug>", async () => {
    mockEntities.mockResolvedValueOnce([]);
    render(<MemoryRouter><BuildHome /></MemoryRouter>);
    const link = await screen.findByRole("link", { name: /github pr reviewer/i });
    expect(link.getAttribute("href")).toMatch(/\?example=github-pr-reviewer/);
  });
});
