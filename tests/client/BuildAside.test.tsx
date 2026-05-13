import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import BuildAside from "../../src/client/components/BuildAside";

describe("BuildAside", () => {
  it("blank state shows the three example chips", () => {
    render(<BuildAside example={null} onPick={vi.fn()} />);
    expect(screen.getByText(/Or start from an example/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub PR reviewer/i)).toBeInTheDocument();
    expect(screen.getByText(/CloudWatch investigator/i)).toBeInTheDocument();
    expect(screen.getByText(/Linear backlog groomer/i)).toBeInTheDocument();
  });

  it("calls onPick with the slug when an example chip is clicked", () => {
    const onPick = vi.fn();
    render(<BuildAside example={null} onPick={onPick} />);
    fireEvent.click(screen.getByText(/GitHub PR reviewer/i));
    expect(onPick).toHaveBeenCalledWith("pr-reviewer");
  });

  it("prefilled state lists files Build will create", () => {
    render(<BuildAside example={{ slug: "pr-reviewer", displayName: "GitHub PR reviewer", icon: "🔎" }} onPick={vi.fn()} />);
    expect(screen.getByText(/What Build will create/i)).toBeInTheDocument();
    expect(screen.getByText(/manifest\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/skills\/pr-reviewer\/SKILL\.md/)).toBeInTheDocument();
    expect(screen.getByText(/After submitting/i)).toBeInTheDocument();
  });
});
