/**
 * Convert a companion slug (kebab-case, matching `/^[a-z][a-z0-9-]*$/`) to the
 * camelCase JS identifier the codegen binds it to.
 *
 * A hyphen followed by ANY alphanumeric — including a digit — drops the hyphen
 * and upcases the next char: `github-pr-reviewer-3` → `githubPrReviewer3`.
 * Matching only `[a-z]` (the historical bug) left the literal `-3`, producing
 * the invalid identifier `githubPrReviewer-3` ("Missing initializer in const
 * declaration") and breaking the whole-repo build. `"3".toUpperCase() === "3"`,
 * so digits pass through unchanged.
 *
 * This is the single source of truth. Codegen (`renderRegistryIndex*`), the
 * registry-index rewriter (`rewriteCompanionsIndex`), the validator's
 * expected-export check, and the watcher's import-name fallback ALL route
 * through this — four hand-copied regexes previously drifted and only one was
 * fixed, so a numeric-suffix slug passed codegen but failed validation.
 */
export function slugToCamelCase(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_m, ch: string) => ch.toUpperCase());
}
