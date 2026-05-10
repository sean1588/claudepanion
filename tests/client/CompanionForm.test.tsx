import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { z } from "zod";
import { CompanionForm } from "../../src/client/primitives/CompanionForm.js";

describe("CompanionForm — text and select", () => {
  it("renders a text input for z.string()", () => {
    const schema = z.object({ name: z.string().describe("Your name") });
    render(<CompanionForm schema={schema} onSubmit={() => {}} />);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
  });

  it("renders a select for meta.ui.kind = 'select' with options", () => {
    const schema = z.object({
      env: z.string().meta({ ui: { kind: "select", options: ["dev", "prod"] } }).describe("Env"),
    });
    render(<CompanionForm schema={schema} onSubmit={() => {}} />);
    const sel = screen.getByLabelText(/env/i) as HTMLSelectElement;
    expect(sel.tagName).toBe("SELECT");
    expect(Array.from(sel.options).map((o) => o.value)).toContain("dev");
  });

  it("calls onSubmit with parsed values", () => {
    const schema = z.object({ name: z.string().min(1).describe("Name") });
    const onSubmit = vi.fn();
    render(<CompanionForm schema={schema} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Sean" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Sean" });
  });
});

describe("CompanionForm — datetime/number/checkbox/textarea", () => {
  it("renders datetime-local for z.string().datetime()", () => {
    const schema = z.object({ when: z.string().datetime().describe("When") });
    render(<CompanionForm schema={schema} onSubmit={() => {}} />);
    const inp = screen.getByLabelText(/when/i) as HTMLInputElement;
    expect(inp.type).toBe("datetime-local");
  });

  it("renders number input for z.number()", () => {
    const schema = z.object({ count: z.number().describe("Count") });
    render(<CompanionForm schema={schema} onSubmit={() => {}} />);
    const inp = screen.getByLabelText(/count/i) as HTMLInputElement;
    expect(inp.type).toBe("number");
  });

  it("renders checkbox for z.boolean()", () => {
    const schema = z.object({ enabled: z.boolean().describe("Enabled") });
    render(<CompanionForm schema={schema} onSubmit={() => {}} />);
    const inp = screen.getByLabelText(/enabled/i) as HTMLInputElement;
    expect(inp.type).toBe("checkbox");
  });

  it("renders textarea for meta.ui.kind = 'textarea'", () => {
    const schema = z.object({
      desc: z.string().meta({ ui: { kind: "textarea" } }).describe("Description"),
    });
    render(<CompanionForm schema={schema} onSubmit={() => {}} />);
    const inp = screen.getByLabelText(/description/i);
    expect(inp.tagName).toBe("TEXTAREA");
  });
});

describe("CompanionForm — optionsFrom", () => {
  it("populates a select from /api/tools/<slug>/<tool>", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        result: { content: [{ type: "text", text: JSON.stringify({ items: ["alpha", "beta"] }) }] },
      }),
    }) as any;

    const schema = z.object({
      thing: z.string().meta({
        ui: { kind: "select", optionsFrom: "list_things" },
      }).describe("Thing"),
    });

    render(<CompanionForm schema={schema} onSubmit={() => {}} companionSlug="x" />);
    await screen.findByText("alpha");
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/tools/x/list_things",
      expect.objectContaining({ method: "POST" })
    );
  });
});
