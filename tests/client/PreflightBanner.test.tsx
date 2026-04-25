import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PreflightBanner from "../../src/client/components/PreflightBanner";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions/blocked/preflight") {
      return new Response(JSON.stringify({ ok: false, missingRequired: ["GITHUB_TOKEN"], missingOptional: [] }), { status: 200 });
    }
    if (url === "/api/companions/warn/preflight") {
      return new Response(JSON.stringify({ ok: true, missingRequired: [], missingOptional: ["SLACK_TOKEN"] }), { status: 200 });
    }
    if (url === "/api/companions/ok/preflight") {
      return new Response(JSON.stringify({ ok: true, missingRequired: [], missingOptional: [] }), { status: 200 });
    }
    throw new Error(`unexpected url: ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("PreflightBanner", () => {
  it("renders blocking banner when missingRequired non-empty", async () => {
    render(<PreflightBanner companion="blocked" />);
    await waitFor(() => expect(screen.getByText(/GITHUB_TOKEN/)).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/required/i);
  });

  it("renders soft banner when only missingOptional", async () => {
    render(<PreflightBanner companion="warn" />);
    await waitFor(() => expect(screen.getByText(/SLACK_TOKEN/)).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent(/optional/i);
  });

  it("renders nothing when all env is set", async () => {
    const { container } = render(<PreflightBanner companion="ok" />);
    await waitFor(() => expect(container.textContent).not.toContain("loading"));
    expect(container.firstChild).toBeNull();
  });

  it("calls onStatus with blocked=true when required env missing", async () => {
    const onStatus = vi.fn();
    render(<PreflightBanner companion="blocked" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ blocked: true })));
  });

  it("calls onStatus with blocked=false when ok", async () => {
    const onStatus = vi.fn();
    render(<PreflightBanner companion="ok" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ blocked: false })));
  });
});
