# Claudepanion — Concept & Vision

> **Audience:** the author, and future collaborators joining the project. The **Pitch** section at the top is written to be lift-and-shippable as landing-page copy; the rest is more frank and names trade-offs.

---

## Pitch

**Claudepanion is an AI-native framework for building personal software with Claude Code.**

Traditional frameworks give humans abstractions to write code against — Rails gives you routes and controllers, React gives you components. **An AI-native framework inverts that:** it gives the *agent* a scaffold, a self-describing skill, and a set of MCP primitives, and lets the agent build the software itself. Humans describe what they want; Claude fills in the rest.

The result is a category of software that wasn't economical before: **personal, disposable, purpose-built tools.** A companion for triaging your on-call alerts. A companion for reviewing your team's PRs. A companion for tracking what you read. Not generic SaaS bent to fit your workflow — software shaped to *you*, scaffolded in minutes, thrown away when you're done with it.

Claudepanion provides the host: one localhost URL, pluggable companions, a built-in **Build companion** that creates new companions from descriptions, and a tight integration with Claude Code as the runtime backend. You bring the idea. Claude builds it. You use it in the browser like any other app.

**The punchline:** specialized software used to be expensive, so we all settled for general-purpose SaaS. AI collapsed that cost. The next generation of tools isn't shipped — it's scaffolded, by an agent, on demand, for an audience of one.

---

## Thesis

For decades, the economics of software made specialization rare. Writing a tool cost engineer-hours, so tools had to serve many users to pay for themselves. That's why your workflow runs through Jira instead of a bug tracker shaped like your brain, and why your dashboards come from Datadog instead of the exact three charts you actually look at. One-size-fits-all was the only viable size.

AI changes the cost curve. A sufficiently capable agent can scaffold working software in minutes — not production-hardened software for millions of users, but *good-enough, one-user, one-purpose* software. That used to be economically absurd. It isn't anymore.

What AI *can't* do on its own is run. A chat transcript isn't a tool. To be useful, generated code needs a home: a UI shell, persistence, a way to be opened tomorrow, a way to be shared. That host is what claudepanion provides.

**Claudepanion is a Claude-native companion host.** One process, one URL, many companions. Each companion is a small personal app. Some have Claude integration; the interesting ones do. The scaffold makes starting a new companion cheap, and the **Build companion** makes it cheaper still — describe the tool you want, and Claude scaffolds it into your running instance.

---

## Origin: the oncall-investigator

This project wasn't conceived top-down. It was boiled down from a working artifact.

The [oncall-investigator](../../oncall-investigator) is an on-call triage tool: a React UI where you fill out an alarm, pick log groups, and click *Create Investigation*. You get back a copyable slash command like `/oncall-investigate inv-abc123`. You paste that into Claude Code. Claude runs the investigation — querying CloudWatch through an MCP proxy, correlating code, drafting a report — and streams its progress back to the same browser tab. When it finishes, the report appears in the UI. You read, act, share the JSON file with a teammate.

It's a useful tool. But looking at it, the useful parts weren't the CloudWatch-specific code. The useful parts were the **shape**:

- A form that produces an entity
- A slash command that hands that entity to Claude
- A skill that tells Claude exactly what to do with it
- MCP tools Claude calls to report progress and persist results
- A detail page in the UI that renders the work as it happens
- JSON files as the sole storage layer — portable, shareable, no DB

Strip out CloudWatch, and what's left is a pattern general enough to build *many* tools. Swap in a different form, a different skill, a different set of MCP tools, and you have a PR triager, or a reading tracker, or a home automation dashboard. The pattern is the product. Claudepanion is that pattern, productized.

---

## What a companion is

A companion is a small app that lives inside the claudepanion host. Every companion has (or can have) these ten elements:

1. **A form** — where the user describes the work to be done, or the thing to be tracked.
2. **An entity** — the submitted form becomes a record with a stable ID (e.g. `build-abc123`, `inv-xyz`).
3. **A slash command** — `/build-companion <id>`, `/oncall-investigate <id>`. A stable, explicit handoff surface between the UI and Claude Code.
4. **A skill** — a Claude Code skill file that serves as the body of the slash command. It tells Claude exactly what MCP tools to call and in what order.
5. **MCP tools** — the server exposes tools Claude calls to read inputs, write progress, and persist results. The agent never touches external systems directly; everything flows through the MCP server.
6. **A detail page** — a per-entity view in the UI that shows inputs and a live log tail of Claude's work. Logs stream from MCP tool calls to the browser via SSE or polling.
7. **A terminal artifact** — a report, a generated companion, a computed result. Something Claude saves at the end that the UI renders.
8. **Per-entity JSON storage** — no database. One file per entity, on disk, atomic writes. Portable and shareable.
9. **A plugin manifest** — `.claude-plugin/plugin.json` registers the companion's MCP server and skill with Claude Code. One install command, one place.
10. **Proxy tools for external services** — when a companion needs AWS, GitHub, or any other external API, it exposes an MCP proxy tool. Credentials live server-side; Claude never runs `aws` or `gh` directly.

Not every companion uses all ten. A Claude-less dashboard companion might skip 3–5 and 7. The Build companion uses all of them, because it is the canonical example.

---

## Claude-native by intention

Claudepanion is *intentionally* Claude-native. The primitives — MCP tool groups, slash-command handoffs, skill playbooks — exist because Claude Code is the assumed runtime. When a design trade-off surfaces between "helps Claude-driven companions" and "helps Claude-less companions," Claude-driven wins. Every time.

It is true that a companion can be built without ever registering an MCP tool. That works. The scaffold doesn't enforce Claude involvement. But that's a property of the architecture, not a feature. Rails runs without ActiveRecord; nobody frames Rails as "database-optional." Similarly, claudepanion runs without Claude-driven companions; we don't frame it as Claude-optional. It's **Claude-native, full stop.** The side door is a side door.

This stance clarifies a lot. The documentation doesn't need to hedge for two audiences. The examples don't need to demonstrate both paths. The scaffold doesn't need to smooth over the rough edges of building a non-Claude companion on top of it. If someone wants a plain localhost web app, React + Vite is right there. If someone wants *Claude at their back while they work*, that's claudepanion.

---

## The Claude Code primitives we lean on

Four primitives, each doing real work:

**Plugins.** Claude Code plugins are the distribution mechanism. A single `.claude-plugin/plugin.json` declares the MCP server and the skill. `investigator plugin install` (or its claudepanion equivalent) registers both with Claude Code via `.claude/settings.local.json`. The user doesn't have to wire up MCP servers or remember slash commands — installing the plugin makes everything discoverable from any Claude Code session.

**MCP (Model Context Protocol).** MCP is how Claude calls into the claudepanion server. The server runs a Streamable HTTP transport at `/mcp`. Tools are typed functions with JSON Schema — Claude discovers them, invokes them, and the server handles side effects (reading files, writing progress, calling AWS). MCP is the runtime contract between agent and host.

**Skills.** A skill is a markdown file with frontmatter that becomes a slash command in Claude Code. The body is a playbook — step-by-step instructions telling Claude what to do. Skills are where the *intelligence* of each companion lives. They're not prompts the user has to remember; they're codified workflows.

**Slash commands.** The explicit handoff from UI to agent. When the UI renders a copyable `/build-companion <id>` on a pending task, the user pastes it into Claude Code and Claude executes the skill. This is how the UI *invokes* Claude.

### Why slash commands beat session-start polling

Earlier versions of claudepanion included instructions in the skill like *"at session start, consider calling build_list to check for pending work."* This pattern looks reasonable and doesn't work reliably. Claude's behavior at session start depends on it reading the skill, deciding the cue applies, and proactively calling a tool without being asked. In practice, that's a coin flip.

Slash commands remove the ambiguity. The user *types* the command. Claude *must* execute the skill body. There is no "consider" and no "if appropriate" — it's an imperative. Every handoff in claudepanion flows through an explicit slash command for this reason. **Soft instructions aren't mechanisms; slash commands are.**

---

## Build as the hero, and the engine

The **Build companion** is the most important companion in claudepanion. Not because it's the most useful — plenty of future companions will be more useful to any individual user — but because it proves the thesis.

Build is a companion that scaffolds other companions. You fill in a form describing the tool you want ("track books I'm reading and have Claude summarize them"), submit, and get back a `/build-companion <id>` slash command. Paste it into Claude Code, and Claude reads the request via MCP, scaffolds a new companion in your claudepanion instance (routes, MCP tools, skill, UI pages), registers it, and reports completion. Restart the server, and the new companion is live.

This is the **self-replicating primitive**. It makes the marginal cost of a new companion approximately *"type a paragraph and wait."* Everything else in claudepanion exists to make Build work, and everything after Build exists because Build made it cheap.

If Build works — really works, reliably, for non-trivial companions — claudepanion isn't just an app framework. It's an on-ramp to personalized software.

---

## What makes this an *AI-native* framework

Traditional software frameworks target human developers. React gives you `useState` and JSX because humans write components. Rails gives you `ActiveRecord::Base` because humans write models. The abstractions are shaped to the way *people* think about code.

Claudepanion is designed for an agent to build on. The important artifacts aren't helper libraries; they're:

- **Structural conventions** an agent can follow without ambiguity — where files go, how routes are registered, how MCP tools are named.
- **A self-describing skill** — the `use-claudepanion` skill tells Claude how to extend claudepanion itself. The framework documents its own extension points *in a language the agent can execute.*
- **Scaffolding tools exposed as MCP calls** — Build isn't a CLI. It's an MCP-driven companion. The agent is a first-class user of the framework.

This is a different shape than existing AI app frameworks. **CopilotKit, assistant-ui, and Vercel AI SDK** wrap the API and put a chat UI on top of your existing app — the agent lives *inside* the product. **LangChain / LangGraph** are orchestration libraries for agents that developers then deploy as traditional backends. **Claude Code itself** is an agent-in-a-terminal for general software work.

Claudepanion is none of these. It's a framework where the *agent is the backend*, the *human is the user of a browser UI*, and the framework is designed so the agent can extend itself. That's the architectural bet.

---

## What we aren't

- **Not a SaaS framework.** Not Retool. Not Appsmith. Not a drag-and-drop app builder.
- **Not CopilotKit / assistant-ui.** We don't sprinkle an AI chat widget into your existing app; we make the agent the backbone.
- **Not a LangChain-style orchestration library.** We don't help you deploy agents to production for other people. We help you run an agent for *yourself*.
- **Not a replacement for Claude Code.** Claude Code is the runtime. Claudepanion is the host that gives it persistence, a browser UI, and a library of slash commands.
- **Not a chat UI.** Claudepanion companions have purpose-built UIs — forms, dashboards, detail pages. Chat stays in the terminal where it belongs.

---

## Tensions (owned, not resolved)

Three real tensions worth naming. Each is a trade-off we're currently living with.

### 1. Why a browser UI for things Claude Code already does?

Claude Code runs in the terminal. Someone will reasonably ask: if Claude can read your logs and write a report in chat, why does claudepanion exist? Three answers:

- **Persistence across sessions.** A terminal transcript ends. An investigation JSON file doesn't. Companions accumulate history.
- **Visual artifacts.** Tables, dashboards, long live-log tails, per-entity detail pages — these are awkward in a terminal and natural in a browser.
- **Ambient presence.** `localhost:3000` stays open in a tab. It's glanceable. The terminal isn't.

### 2. The polling pattern isn't universal

The canonical companion shape — list, claim, log, complete — fits *work-producing* companions (Build, Investigator). It doesn't fit dashboards ("show me current AWS costs"), trackers ("log my reading"), or lookup tools. The skill, the detail page template, and the MCP tool vocabulary currently lean toward work-producing companions. Other shapes are possible but less well-supported. Future versions should articulate multiple patterns, not pretend the first one is universal.

### 3. Single-user localhost — for now

Claudepanion currently assumes one user on `localhost`. No auth, no multi-tenancy, no sharing beyond "send someone the JSON file." This is how the architecture stays radically simple.

It is *not* a permanent commitment. A hosted service, where companions run in the cloud and can be consumed by a team or an organization, is plausible as a later direction — company-wide companions ("triage the on-call queue," "summarize this week's PRs") would be genuinely useful. That future would require real auth, real state management, and real security boundaries. We're not there yet and don't need to be. But the door is open.

---

## Unresolved design questions

Things we're actively debating in the near-term design. Distinct from the tensions above (trade-offs we've chosen to live with) and from the future paths below (directions we might take someday).

1. **Build's scope — scaffold only, or also iterate on existing companions?** Scaffolding a new companion from a description is tractable. Modifying an existing companion — reasoning about its current code, respecting its contract, updating tests — is meaningfully harder. Version 1 is likely scaffold-only; iteration may come later.

2. **How companions become live after Build creates them.** Options: restart the server, a file-watcher that hot-reloads, or a manifest-regeneration step. Restart is simplest and most honest; hot-reload is smoother UX but more machinery.

3. **Polling vs SSE for log streams.** The oncall-investigator pattern polls every 2 seconds — cheap, dumb, correct. SSE is cleaner but adds a connection-lifecycle problem (reconnects, disconnection detection, ordering). Leaning polling for v1; revisit if the UX suffers.

4. **Skill layout — one skill per companion, or one umbrella skill that dispatches?** Each companion shipping its own skill (`/build-companion`, `/oncall-investigate`) is explicit and discoverable. An umbrella skill (`/claudepanion <companion> <id>`) is tidier but hides which companion is which. Leaning per-companion.

5. **Companion isolation — can one companion call another companion's MCP tools?** Powerful concept: compose companions, let Build call a "review-companion" during scaffolding, let a dashboard consume another companion's data, let a notifier react to state changes across companions. Also risky: naive implementations create implicit coupling and make companions hard to share independently. Worth doing — but with care. Probably requires explicit declarations of what each companion "consumes," some form of review gate, and a clear story for versioning and breakage when one companion's tools change underneath another.

6. **Build as built-in, or as the first companion anyone installs?** If Build is part of claudepanion's core, it's privileged — a fresh install already has it. If it's just the first companion, vanilla claudepanion is a bare host with zero companions and the user installs Build first. Privileged is friendlier; bare is more honest about what the scaffold actually is.

7. **Error recovery when Claude stalls or crashes mid-run.** If Claude dies partway through an investigation, the entity's status is stuck at `in_progress` forever. How does the UI know? Timeout heuristics? A "looks stuck, re-trigger" button? Who cleans up the partial state? No good answer yet.

---

## Example companions

*(Placeholder — to be filled in deliberately. Candidates under consideration include on-call triage, PR review, reading tracker, CloudWatch dashboard, expense categorizer. The hero example is Build itself.)*

---

## Open questions and future paths

- **Monetization path.** A hosted claudepanion is one candidate. Org-wide companions (shared across a company's employees) are a natural upsell. Not a near-term decision.
- **Companion marketplace.** If scaffolding companions becomes cheap, *sharing* them becomes the next question. A registry? A `plugin install` equivalent? Open.
- **Non-Claude agents.** The architecture doesn't fundamentally require Claude — any MCP-speaking agent could in principle drive a companion. Whether to support that or stay Claude-exclusive is a positioning question, not a technical one. For now, Claude-native full stop.
- **Run-as-daemon.** Currently `investigator serve` (or equivalent) is a foreground process. A long-running background daemon with auto-start on login would change the ambient-presence story.

---

## Summary, in one paragraph

Claudepanion is a Claude-native companion host: one localhost URL, many small personal apps, each with a form, a detail page, a slash command, a skill, and a set of MCP tools. The **Build** companion scaffolds new companions from descriptions, making the marginal cost of a new personal tool close to zero. The thesis is that AI has collapsed the economics of specialized software — one-user, one-purpose tools are now cheap — and that the missing piece is a *host* for those tools, designed so the agent can build and extend it. Claudepanion is that host, and in doing so, it defines a new category: **AI-native frameworks**, built for agents to develop on.
