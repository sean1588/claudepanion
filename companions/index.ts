import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { build } from "./build/index.js";
import { githubPrReviewer } from "./github-pr-reviewer/index.js";

export const companions: RegisteredCompanion[] = [build, githubPrReviewer];
