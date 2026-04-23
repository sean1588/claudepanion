import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SlashCommandBlock from "../../src/client/components/SlashCommandBlock";

describe("SlashCommandBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the slash command text", () => {
    render(<SlashCommandBlock command="/foo-companion foo-abc" />);
    expect(screen.getByText("/foo-companion foo-abc")).toBeInTheDocument();
  });

  it("calls navigator.clipboard.writeText on Copy click", () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<SlashCommandBlock command="/foo-companion foo-abc" />);
    const buttons = screen.getAllByRole("button", { name: /copy/i });
    fireEvent.click(buttons[0]);
    expect(writeText).toHaveBeenCalledWith("/foo-companion foo-abc");
  });
});
