import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { build } from "./build/index.js";
import { expenseTracker } from "./expense-tracker/index.js";

export const companions: RegisteredCompanion[] = [build, expenseTracker];
