import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EntityList from "../../src/client/pages/EntityList";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/companions")) {
      return new Response(JSON.stringify([
        { name: "x", kind: "entity", displayName: "Xer", icon: "🧪", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    if (url.startsWith("/api/entities?companion=x")) {
      return new Response(JSON.stringify([
        { id: "x-1", companion: "x", status: "running", statusMessage: null, createdAt: "2026-04-22T10:00:00Z", updatedAt: "2026-04-22T10:01:00Z", input: { description: "thing one" }, artifact: null, errorMessage: null, errorStack: null, logs: [] },
      ]), { status: 200 });
    }
    throw new Error(`unexpected ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("EntityList", () => {
  it("renders companion title and entity rows", async () => {
    render(
      <MemoryRouter initialEntries={["/c/x"]}>
        <Routes><Route path="/c/:companion" element={<EntityList />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Xer" })).toBeInTheDocument());
    expect(screen.getByText("thing one")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});
