import { z } from "zod";
import { Octokit } from "@octokit/rest";
import type { CompanionToolDefinition } from "../../../src/shared/types.js";
import {
  successResult,
  configErrorResult,
  inputErrorResult,
  transientErrorResult,
} from "../../../src/shared/types.js";

function getOctokit(): Octokit | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return new Octokit({ auth: token });
}

function parseRepo(repo: string): { owner: string; repo: string } | null {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

export const tools: CompanionToolDefinition[] = [
  {
    name: "github_pr_reviewer_get_pr",
    description:
      "Fetch PR metadata from GitHub (title, author, URL, state, file count, labels). Requires GITHUB_TOKEN with repo scope.",
    schema: {
      repo: z.string().describe("GitHub repo in owner/repo format"),
      prNumber: z.number().int().positive().describe("Pull request number"),
    },
    async handler(params: Record<string, unknown>) {
      const { repo, prNumber } = params as { repo: string; prNumber: number };
      const octokit = getOctokit();
      if (!octokit)
        return configErrorResult("GITHUB_TOKEN", "create a token at github.com/settings/tokens with repo scope");
      const parsed = parseRepo(repo);
      if (!parsed) return inputErrorResult(`repo must be in owner/repo format, got: ${repo}`);
      try {
        const { data: pr } = await octokit.pulls.get({
          owner: parsed.owner,
          repo: parsed.repo,
          pull_number: prNumber,
        });
        const { data: files } = await octokit.pulls.listFiles({
          owner: parsed.owner,
          repo: parsed.repo,
          pull_number: prNumber,
          per_page: 100,
        });
        return successResult({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          author: pr.user?.login ?? "unknown",
          state: pr.state,
          draft: pr.draft,
          body: pr.body ?? "",
          labels: pr.labels.map((l) => l.name),
          filesChanged: pr.changed_files,
          additions: pr.additions,
          deletions: pr.deletions,
          commits: pr.commits,
          baseBranch: pr.base.ref,
          headBranch: pr.head.ref,
          files: files.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch ?? null,
          })),
        });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if (e.status === 404) return inputErrorResult(`PR #${prNumber} not found in ${repo}`);
        if (e.status === 401) return configErrorResult("GITHUB_TOKEN", "token is invalid or expired");
        if (e.status === 403) return configErrorResult("GITHUB_TOKEN", "token lacks repo scope or rate limit exceeded");
        return transientErrorResult(`GitHub API error: ${e.message ?? String(err)}`);
      }
    },
  },

  {
    name: "github_pr_reviewer_get_diff",
    description:
      "Fetch the unified diff for a GitHub PR as a single text blob. Requires GITHUB_TOKEN with repo scope.",
    schema: {
      repo: z.string().describe("GitHub repo in owner/repo format"),
      prNumber: z.number().int().positive().describe("Pull request number"),
    },
    async handler(params: Record<string, unknown>) {
      const { repo, prNumber } = params as { repo: string; prNumber: number };
      const token = process.env.GITHUB_TOKEN;
      if (!token)
        return configErrorResult("GITHUB_TOKEN", "create a token at github.com/settings/tokens with repo scope");
      const parsed = parseRepo(repo);
      if (!parsed) return inputErrorResult(`repo must be in owner/repo format, got: ${repo}`);
      try {
        const response = await fetch(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${prNumber}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.diff",
            },
          }
        );
        if (response.status === 404) return inputErrorResult(`PR #${prNumber} not found in ${repo}`);
        if (response.status === 401) return configErrorResult("GITHUB_TOKEN", "token is invalid or expired");
        if (response.status === 403) return configErrorResult("GITHUB_TOKEN", "token lacks repo scope or rate limit exceeded");
        if (!response.ok) return transientErrorResult(`GitHub API returned ${response.status}`);
        const diff = await response.text();
        return successResult(diff);
      } catch (err: unknown) {
        return transientErrorResult(`Network error: ${(err as Error).message ?? String(err)}`);
      }
    },
  },

  {
    name: "github_pr_reviewer_get_comments",
    description:
      "Fetch existing review comments and issue comments on a GitHub PR. Requires GITHUB_TOKEN with repo scope.",
    schema: {
      repo: z.string().describe("GitHub repo in owner/repo format"),
      prNumber: z.number().int().positive().describe("Pull request number"),
    },
    async handler(params: Record<string, unknown>) {
      const { repo, prNumber } = params as { repo: string; prNumber: number };
      const octokit = getOctokit();
      if (!octokit)
        return configErrorResult("GITHUB_TOKEN", "create a token at github.com/settings/tokens with repo scope");
      const parsed = parseRepo(repo);
      if (!parsed) return inputErrorResult(`repo must be in owner/repo format, got: ${repo}`);
      try {
        const [{ data: reviewComments }, { data: issueComments }, { data: reviews }] = await Promise.all([
          octokit.pulls.listReviewComments({
            owner: parsed.owner,
            repo: parsed.repo,
            pull_number: prNumber,
            per_page: 100,
          }),
          octokit.issues.listComments({
            owner: parsed.owner,
            repo: parsed.repo,
            issue_number: prNumber,
            per_page: 50,
          }),
          octokit.pulls.listReviews({
            owner: parsed.owner,
            repo: parsed.repo,
            pull_number: prNumber,
          }),
        ]);
        return successResult({
          reviews: reviews.map((r) => ({
            author: r.user?.login ?? "unknown",
            state: r.state,
            body: r.body,
            submittedAt: r.submitted_at,
          })),
          reviewComments: reviewComments.map((c) => ({
            author: c.user?.login ?? "unknown",
            path: c.path,
            line: c.line ?? null,
            body: c.body,
            createdAt: c.created_at,
          })),
          issueComments: issueComments.map((c) => ({
            author: c.user?.login ?? "unknown",
            body: c.body,
            createdAt: c.created_at,
          })),
        });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if (e.status === 404) return inputErrorResult(`PR #${prNumber} not found in ${repo}`);
        if (e.status === 401) return configErrorResult("GITHUB_TOKEN", "token is invalid or expired");
        if (e.status === 403) return configErrorResult("GITHUB_TOKEN", "token lacks repo scope or rate limit exceeded");
        return transientErrorResult(`GitHub API error: ${e.message ?? String(err)}`);
      }
    },
  },
];
