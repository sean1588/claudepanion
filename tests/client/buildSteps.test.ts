import { describe, it, expect } from "vitest";
import { deriveSteps, BUILD_STEPS } from "../../src/client/lib/buildSteps";
import type { Entity } from "@shared/types";

function entityWith(status: Entity["status"], lines: string[]): Entity {
  return {
    id: "build-test", companion: "build",
    status, input: {}, artifact: null, errorMessage: null, errorStack: null, statusMessage: null,
    createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    logs: lines.map((message, i) => ({ timestamp: new Date(Date.now() + i * 1000).toISOString(), level: "info", message })),
  } as Entity;
}

describe("deriveSteps", () => {
  it("returns 6 steps in order regardless of input", () => {
    const result = deriveSteps(entityWith("pending", []));
    expect(result.map((s) => s.label)).toEqual(BUILD_STEPS);
  });

  it("all steps pending when entity has no logs", () => {
    const result = deriveSteps(entityWith("pending", []));
    expect(result.every((s) => s.status === "pending")).toBe(true);
  });

  it("marks reading-prompt as active when only that pattern has matched", () => {
    const result = deriveSteps(entityWith("running", ["reading prompt for build-x"]));
    expect(result[0].status).toBe("active");
    expect(result[1].status).toBe("pending");
  });

  it("marks earlier steps done when a later one matches", () => {
    const result = deriveSteps(entityWith("running", [
      "reading prompt",
      "drafting manifest.ts",
      "writing companions/foo/index.ts",
    ]));
    expect(result[0].status).toBe("done");      // Reading prompt
    expect(result[1].status).toBe("done");      // Designing
    expect(result[2].status).toBe("pending");   // Generating form schema — no match
    expect(result[3].status).toBe("active");    // Wiring MCP tools
    expect(result[4].status).toBe("pending");
  });

  it("marks active step as failed when entity status is error", () => {
    const result = deriveSteps(entityWith("error", [
      "reading prompt",
      "writing companions/foo/server/tools.ts",
    ]));
    expect(result[3].status).toBe("failed");
  });

  it("marks all matched steps done when entity status is completed", () => {
    const result = deriveSteps(entityWith("completed", [
      "reading prompt",
      "drafting manifest",
      "writing types.ts",
      "writing companions/foo/server/tools.ts",
      "writing skills/foo/SKILL.md",
      "validator passed",
    ]));
    expect(result.every((s) => s.status === "done")).toBe(true);
  });
});
