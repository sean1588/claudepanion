import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CompanionRoute from "../../src/client/pages/CompanionRoute";

function mockFetch(handlers: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    for (const [prefix, body] of Object.entries(handlers)) {
      if (url.startsWith(prefix)) {
        return new Response(JSON.stringify(body), { status: 200 });
      }
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/c/${slug}`]}>
      <Routes>
        <Route path="/c/:companion" element={<CompanionRoute />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("CompanionRoute mount-failure handling", () => {
  it("shows a restart instruction when the companion built but its remount needs a server restart", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/companions/github-pr-reviewer/mount-status": {
        mounted: false,
        failure: { slug: "github-pr-reviewer", stage: "import-threw", message: "Cannot find package '@octokit/rest'", remedy: "restart", at: "2026-05-16T00:00:00.000Z" },
      },
      "/api/companions": [{ name: "build", kind: "ui", displayName: "Build", icon: "🔨", description: "", contractVersion: "2", version: "0.1.0" }],
    }));
    renderAt("github-pr-reviewer");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /needs a restart to load it/i })).toBeInTheDocument();
      expect(screen.getByText(/Run `claudepanion serve` again\./)).toBeInTheDocument();
    });
  });

  it("shows a rebuild instruction for a stale-dist failure", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/companions/foo/mount-status": {
        mounted: false,
        failure: { slug: "foo", stage: "dist-stale", message: "dist file is older than source", remedy: "rebuild", at: "2026-05-16T00:00:00.000Z" },
      },
      "/api/companions": [],
    }));
    renderAt("foo");
    await waitFor(() => {
      expect(screen.getByText(/claudepanion scaffold foo/)).toBeInTheDocument();
      expect(screen.queryByText(/npm run build/)).not.toBeInTheDocument();
    });
  });

  it("falls back to plain 'Unknown companion' when there is no recorded failure", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/companions/ghost/mount-status": { mounted: false, failure: null },
      "/api/companions": [],
    }));
    renderAt("ghost");
    await waitFor(() => {
      expect(screen.getByText(/unknown companion/i)).toBeInTheDocument();
    });
  });
});
