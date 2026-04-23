import type { RegisteredCompanion } from "../../src/server/companion-registry";
import { manifest } from "./manifest";
import { tools } from "./server/tools";

export const expenseTracker: RegisteredCompanion = { manifest, tools };
