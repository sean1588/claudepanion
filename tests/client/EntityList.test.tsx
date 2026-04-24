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

  it("renders BuildEmptyState when companion is build and entities are empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/companions")) {
        return new Response(JSON.stringify([
          { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0" },
        ]), { status: 200 });
      }
      if (url.startsWith("/api/entities?companion=build")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    }));
    render(
      <MemoryRouter initialEntries={["/c/build"]}>
        <Routes><Route path="/c/:companion" element={<EntityList />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/I'm Build — your first companion/i)).toBeInTheDocument());
    expect(screen.queryByText(/No entries yet/i)).toBeNull();
  });

  it("does not render BuildEmptyState when Build has entities", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/companions")) {
        return new Response(JSON.stringify([
          { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0" },
        ]), { status: 200 });
      }
      if (url.startsWith("/api/entities?companion=build")) {
        return new Response(JSON.stringify([
          { id: "build-xyz", companion: "build", status: "pending", statusMessage: null, createdAt: "2026-04-22T10:00:00Z", updatedAt: "2026-04-22T10:01:00Z", input: { mode: "new-companion", name: "foo-slug", kind: "entity", description: "a short description" }, artifact: null, errorMessage: null, errorStack: null, logs: [] },
        ]), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    }));
    render(
      <MemoryRouter initialEntries={["/c/build"]}>
        <Routes><Route path="/c/:companion" element={<EntityList />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("foo-slug")).toBeInTheDocument());
    expect(screen.queryByText(/I'm Build — your first companion/i)).toBeNull();
  });
});
