import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { expenseTracker } from "./expense-tracker/index.js";

export const companions: RegisteredCompanion[] = [expenseTracker];
