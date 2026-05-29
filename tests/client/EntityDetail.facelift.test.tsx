import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

const mockEntity = vi.fn();
vi.mock("../../src/client/hooks/useEntityPolling", () => ({
  useEntityPolling: () => ({ entity: mockEntity(), isPolling: false }),
}));
vi.mock("../../src/client/hooks/useCompanions", () => ({
  useCompanions: () => ({ companions: [{ name: "build", displayName: "Build", icon: "🔨", kind: "ui" }], loading: false }),
}));
vi.mock("../../src/client/api", () => ({
  fetchCompanions: vi.fn().mockResolvedValue([{ name: "build", displayName: "Build", icon: "🔨", kind: "ui" }]),
  continueEntity: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../src/client/hooks/useMcpStatus", () => ({
  useMcpStatus: () => ({ loading: false, firstRequestAt: null, lastRequestAt: null }),
}));

import EntityDetail from "../../src/client/pages/EntityDetail";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/c/:companion/:id" element={<EntityDetail />} /></Routes>
    </MemoryRouter>
  );
}

describe("EntityDetail (facelift)", () => {
  it("renders the build step labels for a Build entity in running state", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "running", logs: [{ message: "reading prompt", at: "x", level: "info" }],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/build/build-1");
    // Active step "Reading prompt" appears in both the running status card and the steps list.
    expect(screen.getAllByText("Reading prompt").length).toBeGreaterThan(0);
    expect(screen.getByText("First boot")).toBeInTheDocument();
  });

  it("renders an 'open companion' link inside the completed artifact card", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "completed", logs: [],
      input: { name: "pr-reviewer" }, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
      artifact: { markdown: "Done.", filesCreated: [], filesModified: [] },
    });
    renderAt("/c/build/build-1");
    expect(screen.getByRole("link", { name: /open companion/i })).toBeInTheDocument();
  });

  it("does NOT render an 'open companion' link before status is completed", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "running", logs: [],
      input: { name: "pr-reviewer" }, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/build/build-1");
    expect(screen.queryByRole("link", { name: /open companion/i })).toBeNull();
  });

  it("shows error panel only when status is error", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "error", logs: [],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
      errorMessage: "boom",
    });
    renderAt("/c/build/build-1");
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^retry$/i })).toBeInTheDocument();
  });

  it("does NOT render the step list for non-Build companions", () => {
    mockEntity.mockReturnValue({
      id: "x", companion: "pr-reviewer", status: "running", logs: [],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/pr-reviewer/x");
    expect(screen.queryByText("Reading prompt")).toBeNull();
  });
});
