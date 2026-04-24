import type { ToolHandler } from "../../../src/server/companion-registry.js";
import { defineTool } from "../../../src/server/tool-meta.js";

const state = {
  lights: new Map<string, boolean>(),
  scene: "day" as "day" | "night" | "movie",
};

export const tools: Record<string, ToolHandler> = {
  homelab_lights_on: defineTool(
    async (args: any) => {
      if (typeof args?.room !== "string") throw new Error("room required");
      state.lights.set(args.room, true);
      return { room: args.room, on: true };
    },
    {
      description: "Turn on the lights in a room.",
      params: [{ name: "room", type: "string", required: true }],
    }
  ),
  homelab_lights_off: defineTool(
    async (args: any) => {
      if (typeof args?.room !== "string") throw new Error("room required");
      state.lights.set(args.room, false);
      return { room: args.room, on: false };
    },
    {
      description: "Turn off the lights in a room.",
      params: [{ name: "room", type: "string", required: true }],
    }
  ),
  homelab_status: defineTool(
    async () => ({
      scene: state.scene,
      lights: Object.fromEntries(state.lights),
    }),
    { description: "Report current scene + lights state.", params: [] }
  ),
  homelab_set_scene: defineTool(
    async (args: any) => {
      const allowed = ["day", "night", "movie"];
      if (!allowed.includes(args?.scene)) throw new Error(`scene must be one of ${allowed.join(", ")}`);
      state.scene = args.scene;
      return { scene: state.scene };
    },
    {
      description: "Set the active scene.",
      params: [
        { name: "scene", type: "enum", enum: ["day", "night", "movie"], required: true },
      ],
    }
  ),
};
