import { describe, it, expect } from "vitest";
import { slugToCamelCase } from "../../src/shared/slug";

describe("slugToCamelCase", () => {
  it("camelCases a plain kebab slug", () => {
    expect(slugToCamelCase("github-pr-reviewer")).toBe("githubPrReviewer");
  });

  it("passes a single-word slug through unchanged", () => {
    expect(slugToCamelCase("build")).toBe("build");
  });

  it("drops the hyphen before a digit (regression: github-pr-reviewer-3)", () => {
    // The historical bug matched only /-([a-z])/g, leaving the literal `-3`
    // and emitting the invalid identifier `githubPrReviewer-3`
    // ("Missing initializer in const declaration").
    expect(slugToCamelCase("github-pr-reviewer-3")).toBe("githubPrReviewer3");
    expect(slugToCamelCase("a-2-b")).toBe("a2B");
    expect(slugToCamelCase("x-2y")).toBe("x2y");
  });

  it("never leaves a hyphen in the output", () => {
    expect(slugToCamelCase("github-pr-reviewer-3")).not.toMatch(/-/);
    expect(slugToCamelCase("oncall-investigator-2")).not.toMatch(/-/);
  });
});
