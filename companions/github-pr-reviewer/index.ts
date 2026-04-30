import type { RegisteredCompanion } from "../../src/server/companion-registry.js";
import { manifest } from "./manifest.js";
import { tools } from "./server/tools.js";

export const githubPrReviewer: RegisteredCompanion = { manifest, tools };
