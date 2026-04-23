export interface ExpenseInput {
  description: string;
  amount: number;
  continuation?: string;
  previousArtifact?: ExpenseArtifact | null;
}

export interface ExpenseArtifact {
  tag: "food" | "travel" | "office" | "other";
  summary: string;
}
