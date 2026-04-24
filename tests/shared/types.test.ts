import { describe, it, expectTypeOf } from "vitest";
import type { Entity, EntityStatus, LogEntry, Manifest, CompanionKind } from "@shared/types";

describe("shared types", () => {
  it("Entity is parameterized by Input and Artifact", () => {
    type I = { amount: number };
    type A = { tag: string };
    expectTypeOf<Entity<I, A>["input"]>().toEqualTypeOf<I>();
    expectTypeOf<Entity<I, A>["artifact"]>().toEqualTypeOf<A | null>();
  });

  it("EntityStatus is the 4-state union", () => {
    expectTypeOf<EntityStatus>().toEqualTypeOf<"pending" | "running" | "completed" | "error">();
  });

  it("LogEntry has timestamp/level/message", () => {
    const e: LogEntry = { timestamp: "2026-04-22T00:00:00Z", level: "info", message: "x" };
    expectTypeOf(e.level).toEqualTypeOf<"info" | "warn" | "error">();
  });

  it("CompanionKind is entity or tool", () => {
    expectTypeOf<CompanionKind>().toEqualTypeOf<"entity" | "tool">();
  });

  it("Manifest has the declared fields", () => {
    const m: Manifest = {
      name: "x",
      kind: "entity",
      displayName: "X",
      icon: "📦",
      description: "desc",
      contractVersion: "1",
      version: "0.1.0",
    };
    expectTypeOf(m.kind).toEqualTypeOf<CompanionKind>();
  });
});
