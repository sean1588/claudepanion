import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EntityDetail from "../../src/client/pages/EntityDetail";
import type { Entity } from "@shared/types";

function mockFetch(entity: Partial<Entity>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/api/companions")) {
      return new Response(JSON.stringify([
        { name: "x", kind: "entity", displayName: "X", icon: "x", description: "x", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    return new Response(JSON.stringify({
      id: "x-1", companion: "x", status: "pending", statusMessage: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      input: {}, artifact: null, errorMessage: null, errorStack: null, logs: [],
      ...entity,
    }), { status: 200 });
  }));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/c/:companion/:id" element={<EntityDetail />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("EntityDetail", () => {
  it("renders slash command in pending state", async () => {
    mockFetch({ status: "pending" });
    renderAt("/c/x/x-1");
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.getByText("/x-companion x-1")).toBeInTheDocument());
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("renders amber status bar and logs in running state", async () => {
    mockFetch({ status: "running", statusMessage: "step 1", logs: [{ timestamp: "2026-04-22T10:00:00Z", level: "info", message: "hi" }] });
    renderAt("/c/x/x-1");
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.getByText("step 1")).toBeInTheDocument());
    expect(screen.getByText("hi")).toBeInTheDocument();
  });

  it("renders artifact JSON and continuation in completed state", async () => {
    mockFetch({ status: "completed", artifact: { total: 42 } });
    renderAt("/c/x/x-1");
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.getByText("completed")).toBeInTheDocument());
    expect(screen.getByText(/"total": 42/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("renders error message and stack in error state", async () => {
    mockFetch({ status: "error", errorMessage: "boom", errorStack: "at foo" });
    renderAt("/c/x/x-1");
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
    expect(screen.getByText(/at foo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
