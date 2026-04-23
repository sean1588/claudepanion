import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContinuationForm from "../../src/client/components/ContinuationForm";

describe("ContinuationForm", () => {
  it("calls onSubmit with trimmed text on submit", () => {
    const onSubmit = vi.fn();
    render(<ContinuationForm onSubmit={onSubmit} title="revise" hint="h" cta="Continue" placeholder="p" />);
    fireEvent.change(screen.getByPlaceholderText("p"), { target: { value: "  redo it  " } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith("redo it");
  });

  it("does not submit when empty", () => {
    const onSubmit = vi.fn();
    render(<ContinuationForm onSubmit={onSubmit} title="revise" hint="h" cta="Continue" placeholder="p" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
