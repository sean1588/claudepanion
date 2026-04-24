// tests/client/Sidebar.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "../../src/client/components/Sidebar";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions") {
      return new Response(JSON.stringify([
        { name: "expense-tracker", kind: "entity", displayName: "Expense Tracker", icon: "💰", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }));
});

afterEach(() => {
  cleanup();
});

describe("Sidebar", () => {
  it("renders companions fetched from /api/companions", async () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Expense Tracker")).toBeInTheDocument());
    expect(screen.getByText("💰")).toBeInTheDocument();
  });

  it("renders static Core section with Build placeholder", async () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText(/Core/i)).toBeInTheDocument();
  });
});
