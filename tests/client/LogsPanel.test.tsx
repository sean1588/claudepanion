import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LogsPanel from "../../src/client/components/LogsPanel";

describe("LogsPanel", () => {
  it("renders an empty placeholder when no logs and waiting", () => {
    render(<LogsPanel logs={[]} waiting />);
    expect(screen.getByText(/Waiting for Claude/i)).toBeInTheDocument();
  });

  it("renders log entries with level classes", () => {
    render(<LogsPanel logs={[
      { timestamp: "2026-04-22T10:00:00Z", level: "info", message: "hello" },
      { timestamp: "2026-04-22T10:00:01Z", level: "warn", message: "careful" },
    ]} />);
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("careful")).toBeInTheDocument();
  });
});
