import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Sketch } from "../../src/client/icons/Sketch";

describe("Sketch icons", () => {
  it.each(["Companion", "Form", "Slash", "Wrench", "Doc", "Plant", "Search"] as const)(
    "renders %s as an SVG with 48x48 viewBox",
    (name) => {
      const Icon = Sketch[name];
      const { container } = render(<Icon />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute("viewBox")).toBe("0 0 48 48");
      expect(svg!.getAttribute("stroke-width")).toBe("1.4");
    }
  );
});
