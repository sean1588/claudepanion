import type { BaseArtifact } from "../../src/shared/types.js";

export interface GithubPrReviewerInput {
  repo: string;
  prNumber: number;
  focus?: string;
}

export interface GithubPrReviewerArtifact extends BaseArtifact {
  prTitle: string;
  prUrl: string;
  prAuthor: string;
  filesChanged: number;
  risks: string[];
  reviewQuestions: string[];
}
