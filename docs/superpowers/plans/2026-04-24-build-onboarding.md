# Build First-Run Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Build empty-state with a first-person welcome block, five example chips, and a "+ New companion" button. Chip clicks prefill the Build form via a `?example=<slug>` query param.

**Architecture:** Four files touched. One new typed data module (`companions/build/examples.ts`), one new React component (`BuildEmptyState`), one new query-param branch in the existing Build form, and a conditional render in `EntityList`. No server changes, no new deps.

**Tech Stack:** React 18, TypeScript, react-router-dom v6, vitest, @testing-library/react.

**Spec:** [`docs/superpowers/specs/2026-04-24-build-onboarding-design.md`](../specs/2026-04-24-build-onboarding-design.md)

---

## File structure

| Path | Responsibility |
|---|---|
| `companions/build/examples.ts` (new) | Typed catalog of 5 Build examples. Pure data + type. Imported by the form and the empty-state. |
| `src/client/pages/BuildEmptyState.tsx` (new) | Welcome block + chip grid + "+ New companion" button. Pure presentation; reads the examples module, navigates on click. |
| `src/client/pages/EntityList.tsx` (modify) | Branch to render `<BuildEmptyState />` when `companion === "build"` and `entities.length === 0`. |
| `companions/build/form.tsx` (modify) | Read `?example=<slug>` on mount and prefill name/kind/description from the matching example. |
| `tests/client/build-examples.test.ts` (new) | Schema test for the examples catalog. |
| `tests/client/BuildEmptyState.test.tsx` (new) | Render + click-navigation test for the empty-state component. |
| `tests/client/BuildForm.test.tsx` (new) | Prefill-from-query-param test for the form. |
| `tests/client/EntityList.test.tsx` (modify) | Add a case for the Build empty-state branch. |

---

## Task 1: Examples catalog

**Files:**
- Create: `companions/build/examples.ts`
- Test: `tests/client/build-examples.test.ts`

- [ ] **Step 1.1: Write the failing test**

`tests/client/build-examples.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildExamples, type BuildExample } from "../../companions/build/examples";

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

describe("buildExamples", () => {
  it("exports exactly 5 entries", () => {
    expect(buildExamples).toHaveLength(5);
  });

  it.each(buildExamples.map((e) => [e.slug, e]))(
    "%s has a valid shape",
    (_slug, ex: BuildExample) => {
      expect(ex.slug).toMatch(SLUG_RE);
      expect(["entity", "tool"]).toContain(ex.kind);
      expect(ex.displayName.trim()).not.toBe("");
      expect(ex.icon.trim()).not.toBe("");
      expect(ex.description.trim()).not.toBe("");
    }
  );

  it("has unique slugs", () => {
    const slugs = buildExamples.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run tests/client/build-examples.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 1.3: Create the examples module**

`companions/build/examples.ts`:

```ts
export interface BuildExample {
  slug: string;
  kind: "entity" | "tool";
  displayName: string;
  icon: string;
  description: string;
}

export const buildExamples: BuildExample[] = [
  {
    slug: "pr-reviewer",
    kind: "entity",
    displayName: "PR reviewer",
    icon: "🔎",
    description: "Review a PR in this repo, flag risky diffs, and suggest questions to ask the author.",
  },
  {
    slug: "release-notes-drafter",
    kind: "entity",
    displayName: "Release notes drafter",
    icon: "📝",
    description: "Generate user-facing release notes from merged PRs in a git range.",
  },
  {
    slug: "codebase-onboarding-doc",
    kind: "entity",
    displayName: "Codebase onboarding doc",
    icon: "🧭",
    description: 'Read this repo and write a "how to get oriented" doc for new contributors.',
  },
  {
    slug: "design-doc-reviewer",
    kind: "entity",
    displayName: "Design doc reviewer",
    icon: "🪓",
    description: "Critique a pasted design doc: flag ambiguities, missing constraints, unstated assumptions.",
  },
  {
    slug: "postmortem-writer",
    kind: "entity",
    displayName: "Postmortem writer",
    icon: "🕯️",
    description: "Turn a pasted incident timeline into a structured postmortem: impact, root cause, action items.",
  },
];
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx vitest run tests/client/build-examples.test.ts`
Expected: PASS — 3 tests (5 parametrized under `%s has a valid shape` count as 5 sub-tests, total 7).

- [ ] **Step 1.5: Commit**

```bash
git add companions/build/examples.ts tests/client/build-examples.test.ts
git commit -m "onboarding: typed Build examples catalog"
```

---

## Task 2: BuildEmptyState component

**Files:**
- Create: `src/client/pages/BuildEmptyState.tsx`
- Test: `tests/client/BuildEmptyState.test.tsx`

- [ ] **Step 2.1: Write the failing test**

`tests/client/BuildEmptyState.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BuildEmptyState from "../../src/client/pages/BuildEmptyState";
import { buildExamples } from "../../companions/build/examples";

function renderAt(path = "/c/build") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/c/build" element={<BuildEmptyState />} />
        <Route path="/c/build/new" element={<div data-testid="new-page" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BuildEmptyState", () => {
  it("renders the first-person welcome block", () => {
    renderAt();
    expect(screen.getByText(/I'm Build — your first companion/i)).toBeInTheDocument();
  });

  it("renders all 5 example chips by displayName", () => {
    renderAt();
    for (const ex of buildExamples) {
      expect(screen.getByText(ex.displayName)).toBeInTheDocument();
    }
  });

  it("renders the '+ New companion' button", () => {
    renderAt();
    expect(screen.getByRole("button", { name: /\+ New companion/i })).toBeInTheDocument();
  });

  it("navigates to /c/build/new?example=<slug> on chip click", async () => {
    const { container } = renderAt();
    const chip = screen.getByText(buildExamples[0].displayName).closest('[data-testid="chip"]');
    expect(chip).not.toBeNull();
    fireEvent.click(chip!);
    // MemoryRouter doesn't expose window.location, so assert the new-page route rendered.
    expect(await screen.findByTestId("new-page")).toBeInTheDocument();
  });

  it("navigates to /c/build/new with no query on '+ New companion' click", async () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /\+ New companion/i }));
    expect(await screen.findByTestId("new-page")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run tests/client/BuildEmptyState.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 2.3: Create the component**

`src/client/pages/BuildEmptyState.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import { buildExamples, type BuildExample } from "../../../companions/build/examples";

export default function BuildEmptyState() {
  const navigate = useNavigate();

  const openExample = (ex: BuildExample) => {
    navigate(`/c/build/new?example=${ex.slug}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 820 }}>
      <div
        style={{
          border: "1px solid #bae6fd",
          background: "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)",
          borderRadius: 10,
          padding: "20px 22px",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: "#0c4a6e", marginBottom: 8 }}>
          👋 Hi, I'm Build — your first companion.
        </div>
        <p style={{ fontSize: 13, color: "#1e293b", margin: 0, lineHeight: 1.55 }}>
          I scaffold new companions from a plain-English description. Everything else you add to the sidebar came from me. Try one of the ideas below, or describe your own.
        </p>
      </div>

      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
        Ideas to start from
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {buildExamples.map((ex, i) => (
          <button
            key={ex.slug}
            type="button"
            data-testid="chip"
            onClick={() => openExample(ex)}
            style={{
              padding: "12px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#fff",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              cursor: "pointer",
              textAlign: "left",
              // Span both columns if this is the last odd chip.
              gridColumn: i === buildExamples.length - 1 && buildExamples.length % 2 === 1 ? "span 2" : undefined,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">{ex.icon}</span>
            <span>
              <span style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{ex.displayName}</span>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginTop: 2, lineHeight: 1.4 }}>{ex.description}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#94a3b8", fontSize: 11, margin: "4px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        or
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      </div>

      <button
        type="button"
        className="btn"
        onClick={() => navigate("/c/build/new")}
        style={{ alignSelf: "flex-start" }}
      >
        + New companion
      </button>
    </div>
  );
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npx vitest run tests/client/BuildEmptyState.test.tsx`
Expected: PASS — all 5 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/client/pages/BuildEmptyState.tsx tests/client/BuildEmptyState.test.tsx
git commit -m "onboarding: BuildEmptyState component"
```

---

## Task 3: Wire empty-state into EntityList

**Files:**
- Modify: `src/client/pages/EntityList.tsx`
- Test: `tests/client/EntityList.test.tsx`

- [ ] **Step 3.1: Write the failing test (add to existing file)**

Append this test block inside the existing `describe("EntityList", ...)` in `tests/client/EntityList.test.tsx`:

```tsx
  it("renders BuildEmptyState when companion is build and entities are empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/companions")) {
        return new Response(JSON.stringify([
          { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0" },
        ]), { status: 200 });
      }
      if (url.startsWith("/api/entities?companion=build")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    }));
    render(
      <MemoryRouter initialEntries={["/c/build"]}>
        <Routes><Route path="/c/:companion" element={<EntityList />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/I'm Build — your first companion/i)).toBeInTheDocument());
    // The generic "No entries yet" fallback should NOT render.
    expect(screen.queryByText(/No entries yet/i)).toBeNull();
  });

  it("does not render BuildEmptyState when Build has entities", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/companions")) {
        return new Response(JSON.stringify([
          { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0" },
        ]), { status: 200 });
      }
      if (url.startsWith("/api/entities?companion=build")) {
        return new Response(JSON.stringify([
          { id: "build-xyz", companion: "build", status: "pending", statusMessage: null, createdAt: "2026-04-22T10:00:00Z", updatedAt: "2026-04-22T10:01:00Z", input: { mode: "new-companion", name: "foo", kind: "entity", description: "foo" }, artifact: null, errorMessage: null, errorStack: null, logs: [] },
        ]), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    }));
    render(
      <MemoryRouter initialEntries={["/c/build"]}>
        <Routes><Route path="/c/:companion" element={<EntityList />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("foo")).toBeInTheDocument());
    expect(screen.queryByText(/I'm Build — your first companion/i)).toBeNull();
  });
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `npx vitest run tests/client/EntityList.test.tsx`
Expected: FAIL — the new tests can't find the welcome text because EntityList doesn't render BuildEmptyState.

- [ ] **Step 3.3: Wire EntityList to render BuildEmptyState**

Modify `src/client/pages/EntityList.tsx`. Add the import at the top:

```tsx
import BuildEmptyState from "./BuildEmptyState";
```

Replace the `<div className="panel">` block at the bottom of the component. The current block looks like:

```tsx
      <div className="panel entity-list">
        <div className="panel-header entity-list-header">
          <div>Status</div>
          <div>Description</div>
          <div className="entity-list-updated">Updated</div>
        </div>
        {entities.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No entries yet — click "+ New" to get started.</div>
        ) : (
          entities.map((e) => (
            <Link key={e.id} to={`/c/${companion}/${e.id}`} className="entity-list-row">
              <StatusPill status={e.status} />
              {Row ? <Row entity={e} /> : <div>{(e.input as any).description || JSON.stringify(e.input).slice(0, 80)}</div>}
              <div className="entity-list-updated" style={{ color: "var(--muted)" }}>{timeAgo(e.updatedAt)}</div>
            </Link>
          ))
        )}
      </div>
```

Change it to branch before rendering the panel when the Build empty case hits:

```tsx
      {companion === "build" && entities.length === 0 ? (
        <BuildEmptyState />
      ) : (
        <div className="panel entity-list">
          <div className="panel-header entity-list-header">
            <div>Status</div>
            <div>Description</div>
            <div className="entity-list-updated">Updated</div>
          </div>
          {entities.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No entries yet — click "+ New" to get started.</div>
          ) : (
            entities.map((e) => (
              <Link key={e.id} to={`/c/${companion}/${e.id}`} className="entity-list-row">
                <StatusPill status={e.status} />
                {Row ? <Row entity={e} /> : <div>{(e.input as any).description || JSON.stringify(e.input).slice(0, 80)}</div>}
                <div className="entity-list-updated" style={{ color: "var(--muted)" }}>{timeAgo(e.updatedAt)}</div>
              </Link>
            ))
          )}
        </div>
      )}
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `npx vitest run tests/client/EntityList.test.tsx`
Expected: PASS — all EntityList tests green.

- [ ] **Step 3.5: Commit**

```bash
git add src/client/pages/EntityList.tsx tests/client/EntityList.test.tsx
git commit -m "onboarding: wire BuildEmptyState into EntityList"
```

---

## Task 4: Form prefill from ?example=

**Files:**
- Modify: `companions/build/form.tsx`
- Test: `tests/client/BuildForm.test.tsx`

- [ ] **Step 4.1: Write the failing test**

`tests/client/BuildForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BuildForm from "../../companions/build/form";

beforeEach(() => {
  // useCompanions fetches /api/companions — stub it minimally.
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/companions")) {
      return new Response(JSON.stringify([
        { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    throw new Error(`unexpected ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<BuildForm onSubmit={() => { }} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BuildForm ?example= prefill", () => {
  it("prefills name/kind/description from a known example slug", async () => {
    renderAt("/c/build/new?example=pr-reviewer");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const description = await screen.findByLabelText(/^description$/i) as HTMLTextAreaElement;
    const kind = await screen.findByLabelText(/kind/i) as HTMLSelectElement;
    await waitFor(() => {
      expect(name.value).toBe("pr-reviewer");
      expect(kind.value).toBe("entity");
      expect(description.value).toMatch(/flag risky diffs/i);
    });
  });

  it("falls back to an empty form when example slug is unknown", async () => {
    renderAt("/c/build/new?example=does-not-exist");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const description = await screen.findByLabelText(/^description$/i) as HTMLTextAreaElement;
    expect(name.value).toBe("");
    expect(description.value).toBe("");
  });

  it("falls back to an empty form when no example param is given", async () => {
    renderAt("/c/build/new");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    expect(name.value).toBe("");
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `npx vitest run tests/client/BuildForm.test.tsx`
Expected: FAIL — form doesn't read `?example=` yet.

- [ ] **Step 4.3: Update the form to read the query param**

Modify `companions/build/form.tsx`. Add the import near the top:

```tsx
import { buildExamples } from "./examples";
```

Replace the existing state initializers:

```tsx
  const [mode, setMode] = useState<"new-companion" | "iterate-companion">(
    params.get("mode") === "iterate" ? "iterate-companion" : "new-companion"
  );
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"entity" | "tool">("entity");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<string>(params.get("target") ?? "");
```

With an initializer that looks up `?example=<slug>` first:

```tsx
  const exampleSlug = params.get("example");
  const example = exampleSlug ? buildExamples.find((e) => e.slug === exampleSlug) : undefined;

  const [mode, setMode] = useState<"new-companion" | "iterate-companion">(() =>
    example ? "new-companion" : params.get("mode") === "iterate" ? "iterate-companion" : "new-companion"
  );
  const [name, setName] = useState(example?.slug ?? "");
  const [kind, setKind] = useState<"entity" | "tool">(example?.kind ?? "entity");
  const [description, setDescription] = useState(example?.description ?? "");
  const [target, setTarget] = useState<string>(params.get("target") ?? "");
```

Update the existing `useEffect` to also handle the `?example` param so param changes after mount are respected:

```tsx
  useEffect(() => {
    const sl = params.get("example");
    const ex = sl ? buildExamples.find((e) => e.slug === sl) : undefined;
    if (ex) {
      setMode("new-companion");
      setName(ex.slug);
      setKind(ex.kind);
      setDescription(ex.description);
      return;
    }
    if (params.get("mode") === "iterate" && params.get("target")) {
      setMode("iterate-companion");
      setTarget(params.get("target")!);
    }
  }, [params]);
```

- [ ] **Step 4.4: Run test to verify it passes**

Run: `npx vitest run tests/client/BuildForm.test.tsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 4.5: Run the full test suite**

Run: `npm test`
Expected: all tests green (previously 78, now 78 + 3 new + 2 new + 5 new = 88; precise count may differ as some are parametrized).

- [ ] **Step 4.6: Commit**

```bash
git add companions/build/form.tsx tests/client/BuildForm.test.tsx
git commit -m "onboarding: form prefill from ?example query param"
```

---

## Task 5: Local CI + browser smoke

No new code. Runs the full quality gate and a manual browser check of the composed experience.

- [ ] **Step 5.1: Run all quality gates locally**

Run:
```bash
npm run lint && npm run check && npm test && npm run build
```
Expected: lint clean, typecheck clean, all tests pass, build succeeds.

- [ ] **Step 5.2: Start the server**

Kill any existing server, then:

```bash
kill $(lsof -t -i :3001) 2>/dev/null; sleep 1
rm -rf data/build/*.json  # clear any stale test entities so the empty-state renders
PORT=3001 npm start
```

(Run in a second terminal; leave running for the smoke.)

- [ ] **Step 5.3: Smoke the empty-state**

In the browser: navigate to <http://localhost:3001/c/build>. Verify:
- Sidebar shows only 🔨 Build + "+ Install companion" at the bottom.
- Page title "Build" with header CTAs "⟳ Iterate on existing" and "+ New companion" visible.
- Welcome block renders with "👋 Hi, I'm Build — your first companion."
- 5 chips render (PR reviewer / Release notes drafter / Codebase onboarding doc / Design doc reviewer / Postmortem writer). The last chip spans both columns.
- "or" divider visible.
- "+ New companion" button below chips.

- [ ] **Step 5.4: Smoke a chip click**

Click the 🔎 PR reviewer chip. Verify:
- URL becomes `http://localhost:3001/c/build/new?example=pr-reviewer`.
- Companion name field shows `pr-reviewer`.
- Kind dropdown shows "entity — has lifecycle, form, artifacts".
- Description textarea shows "Review a PR in this repo, flag risky diffs, and suggest questions to ask the author."
- Clicking **Scaffold companion** creates a Build entity and lands on the pending detail page.

- [ ] **Step 5.5: Smoke the populated state**

Go back to `/c/build`. Verify:
- The empty-state is gone; the normal list view renders.
- The Build entity created in 5.4 shows up as a pending row with the ✨ new pill and "pr-reviewer" in the row.

- [ ] **Step 5.6: Smoke the fallthrough**

Navigate to `http://localhost:3001/c/build/new?example=does-not-exist`. Verify the form renders with empty fields (no crash).

- [ ] **Step 5.7: Stop the server + commit the smoke marker (optional)**

No artifact to commit; Plan 7-style smoke is a manual gate. Kill the server:

```bash
kill $(lsof -t -i :3001) 2>/dev/null
```
