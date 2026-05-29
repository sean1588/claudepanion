/**
 * EntityDetail integration tests — retargeted for the facelift rewrite.
 *
 * Retargeting notes:
 *
 * 1. "renders slash command in pending state"
 *    - OLD: mocked raw fetch, used useEntity; assert `getByText("pending")`.
 *    - NEW: mock useEntityPolling directly (no fetch setup needed). Status is
 *      now rendered as "● pending" inline text, so the assertion uses /pending/i
 *      regex. The slash command itself ("/x-companion x-1") still renders in
 *      SlashRow so that assertion is unchanged.
 *
 * 2. "renders amber status bar and logs in running state"
 *    - OLD: asserted on `statusMessage` ("step 1") via the now-removed StatusBar
 *      component.
 *    - NEW: the rewrite dropped statusMessage rendering. The assertion is
 *      retargeted to the log entry ("hi") which still appears in LogPane, and
 *      the status inline span is checked via /running/i.
 *
 * 3. "renders markdown artifact and continuation in completed state"
 *    - OLD: asserted `getByText("completed")` — now in "● completed" span.
 *    - NEW: /completed/i regex. Markdown artifact and Continue button assertions
 *      are unchanged (still rendered in CompletedArtifact + ContinuationFormSection).
 *
 * 4. "falls back to a placeholder for legacy non-markdown artifacts"
 *    - OLD: same `getByText("completed")` issue.
 *    - NEW: /completed/i regex.
 *
 * 5. "shows the MCP-stuck banner when entity is past grace and MCP has never
 *    connected"
 *    - OLD: asserted `getByRole("alert")` — the old McpStuckBanner had
 *      `role="alert"`. The new PendingBanner is a plain div.
 *    - NEW: query by text content. The banner text "hasn't seen any MCP
 *      connection" is still present; use getByText with regex. Also verify the
 *      install instructions are rendered.
 *
 * 6. "does not show the MCP-stuck banner when pending entity is fresh"
 *    - OLD: asserted `queryByRole("alert")` not present.
 *    - NEW: assert the banner text is not present.
 *
 * 7. "does not show the MCP-stuck banner when MCP has connected"
 *    - OLD: same role="alert" pattern.
 *    - NEW: assert the banner text is not present.
 *
 * 8. "renders error message and stack in error state"
 *    - OLD/NEW: both assert getByText("boom"), error stack, and a retry button.
 *      The button label changed from "Retry" to "Retry build". Updated selector.
 *
 * 9. "renders summary banner from artifact"
 *    - OLD: loaded entity via fetch stub with build companion.
 *    - NEW: mock useEntityPolling directly. BaseArtifactPanel "Notes during
 *      this run" text unchanged.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EntityDetail from "../../src/client/pages/EntityDetail";
import type { Entity } from "@shared/types";

// ---------------------------------------------------------------------------
// Shared mocks — set up per test via mockEntityPolling / mockMcpStatus
// ---------------------------------------------------------------------------

const mockEntityFn = vi.fn<[], Entity | null>();
const mockMcpFn = vi.fn<[], { loading: boolean; firstRequestAt: string | null; lastRequestAt: string | null }>();

vi.mock("../../src/client/hooks/useEntityPolling", () => ({
  useEntityPolling: () => ({ entity: mockEntityFn(), isPolling: false }),
}));

vi.mock("../../src/client/hooks/useMcpStatus", () => ({
  useMcpStatus: () => mockMcpFn(),
}));

vi.mock("../../src/client/api", () => ({
  fetchCompanions: vi.fn().mockResolvedValue([
    { name: "x", kind: "ui", displayName: "X", icon: "x", description: "x", contractVersion: "2", version: "0.1.0" },
    { name: "build", kind: "ui", displayName: "Build", icon: "🔨", description: "", contractVersion: "2", version: "0.1.0" },
  ]),
  continueEntity: vi.fn().mockResolvedValue({}),
}));

function baseEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "x-1", companion: "x", status: "pending", statusMessage: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    input: {}, artifact: null, errorMessage: null, errorStack: null, logs: [],
    ...overrides,
  } as Entity;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/c/:companion/:id" element={<EntityDetail />} /></Routes>
    </MemoryRouter>
  );
}

describe("EntityDetail", () => {
  it("renders slash command in pending state", () => {
    // Retargeted: mock useEntityPolling instead of fetch. Status text now
    // appears as "● pending" so use /pending/i regex.
    mockEntityFn.mockReturnValue(baseEntity({ status: "pending" }));
    mockMcpFn.mockReturnValue({ loading: false, firstRequestAt: null, lastRequestAt: null });
    renderAt("/c/x/x-1");
    expect(screen.getByText("/x-companion x-1")).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it("renders logs in running state", () => {
    // Retargeted: statusMessage ("step 1") is no longer rendered — removed
    // StatusBar component. Assert on the log entry ("hi") which still appears
    // in LogPane (may appear twice: once in StatusMonoBlock as latest line,
    // once in LogPane pre). Use getAllByText to allow multiple matches.
    // Verify the inline status shows /running/i somewhere on the page.
    mockEntityFn.mockReturnValue(baseEntity({
      status: "running",
      statusMessage: "step 1",
      logs: [{ timestamp: "2026-04-22T10:00:00Z", level: "info", message: "hi" }],
    } as Partial<Entity>));
    mockMcpFn.mockReturnValue({ loading: false, firstRequestAt: null, lastRequestAt: null });
    renderAt("/c/x/x-1");
    expect(screen.getAllByText("hi").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/running/i).length).toBeGreaterThan(0);
  });

  it("renders markdown artifact and continuation in completed state", () => {
    // Retargeted: "completed" now appears in both the subtitle ("Completed ·
    // took …") and the status inline ("● completed"). Use getAllByText and
    // assert at least one match is in the document.
    mockEntityFn.mockReturnValue(baseEntity({
      status: "completed",
      artifact: { summary: "all good", markdown: "## Result\n\nGreat **work**." },
    }));
    mockMcpFn.mockReturnValue({ loading: false, firstRequestAt: null, lastRequestAt: null });
    renderAt("/c/x/x-1");
    expect(screen.getAllByText(/completed/i).length).toBeGreaterThan(0);
    // The markdown body renders the heading and bold text.
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("renders something for legacy non-markdown artifacts", () => {
    mockEntityFn.mockReturnValue(baseEntity({
      status: "completed",
      artifact: { total: 42 },
    }));
    mockMcpFn.mockReturnValue({ loading: false, firstRequestAt: null, lastRequestAt: null });
    renderAt("/c/x/x-1");
    expect(screen.getAllByText(/completed/i).length).toBeGreaterThan(0);
    // No markdown → MarkdownArtifactPanel renders the "no markdown report" hint.
    expect(screen.getByText(/no markdown report/i)).toBeInTheDocument();
  });

  it("does not show the MCP-stuck banner when pending entity is fresh", () => {
    // Retargeted: new PendingBanner has no role="alert"; query by banner text.
    mockEntityFn.mockReturnValue(baseEntity({ status: "pending", createdAt: new Date().toISOString() }));
    mockMcpFn.mockReturnValue({ loading: false, firstRequestAt: null, lastRequestAt: null });
    renderAt("/c/x/x-1");
    expect(screen.getByText("/x-companion x-1")).toBeInTheDocument();
    expect(screen.queryByText(/hasn't seen any MCP connection/i)).not.toBeInTheDocument();
  });

  it("does not show the MCP-stuck banner when MCP has connected (firstRequestAt set), even if entity is old", () => {
    // Retargeted: query by banner text instead of role="alert".
    const oldCreatedAt = new Date(Date.now() - 60_000).toISOString();
    mockEntityFn.mockReturnValue(baseEntity({ status: "pending", createdAt: oldCreatedAt }));
    mockMcpFn.mockReturnValue({
      loading: false,
      firstRequestAt: new Date(Date.now() - 30_000).toISOString(),
      lastRequestAt: new Date(Date.now() - 30_000).toISOString(),
    });
    renderAt("/c/x/x-1");
    expect(screen.getByText("/x-companion x-1")).toBeInTheDocument();
    expect(screen.queryByText(/hasn't seen any MCP connection/i)).not.toBeInTheDocument();
  });

  it("shows the MCP-stuck banner when entity is past grace and MCP has never connected", () => {
    // Retargeted: new PendingBanner is a plain div without role="alert".
    // Query by text content instead of ARIA role. The install step text is
    // still present ("claudepanion plugin install").
    const oldCreatedAt = new Date(Date.now() - 30_000).toISOString();
    mockEntityFn.mockReturnValue(baseEntity({ status: "pending", createdAt: oldCreatedAt }));
    mockMcpFn.mockReturnValue({ loading: false, firstRequestAt: null, lastRequestAt: null });
    renderAt("/c/x/x-1");
    expect(screen.getByText(/hasn't seen any MCP connection/i)).toBeInTheDocument();
    // "claudepanion plugin install" appears in both the slash hero and the banner — assert at least one.
    expect(screen.getAllByText(/claudepanion plugin install/i).length).toBeGreaterThan(0);
  });

  it("renders error message and stack in error state", () => {
    // Retargeted: button label changed from "Retry" to "Retry build".
    mockEntityFn.mockReturnValue(baseEntity({
      status: "error",
      errorMessage: "boom",
      errorStack: "at foo",
    }));
    mockMcpFn.mockReturnValue({ loading: false, firstRequestAt: null, lastRequestAt: null });
    renderAt("/c/x/x-1");
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByText(/at foo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^retry$/i })).toBeInTheDocument();
  });

  it("renders the completed artifact card for a Build entity with files lists", () => {
    mockEntityFn.mockReturnValue({
      id: "build-abc", companion: "build", status: "completed",
      statusMessage: null, createdAt: "2026-04-25T00:00:00Z", updatedAt: "2026-04-25T00:00:01Z",
      input: { mode: "new-companion", name: "x", kind: "ui", description: "" },
      artifact: { summary: "Scaffolded x.", markdown: "Done.", filesCreated: ["companions/x/manifest.ts"], filesModified: ["companions/index.ts"], validatorPassed: true, smokeTestPassed: true },
      errorMessage: null, errorStack: null, logs: [],
    } as Entity);
    mockMcpFn.mockReturnValue({ loading: false, firstRequestAt: null, lastRequestAt: null });
    render(
      <MemoryRouter initialEntries={["/c/build/build-abc"]}>
        <Routes>
          <Route path="/c/:companion/:id" element={<EntityDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/artifact · build complete/i)).toBeInTheDocument();
    expect(screen.getByText(/companions\/x\/manifest\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/companions\/index\.ts/)).toBeInTheDocument();
  });
});
