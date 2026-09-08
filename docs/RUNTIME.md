# Iktara runtime instructions

This is the runtime contract for Iktara. It explains how the runtime is layered, how agents plug into it, and the rules every agent — coding or product — must follow. The repository is organized like a runtime-layer model: a small executable kernel, a plugin hierarchy that owns the product agents, readable agent profiles, skills, and persistent runtime instructions. Configuration and profiles are OpenCode files and markdown; behavior stays in code.

## Layer map

| Layer | What it is | Where |
| --- | --- | --- |
| L0 — Runtime kernel | The executable product and its services | `apps/local/server/` (Node/OpenCode v2 plugin), `shastra-compute/` (Python chart service), `scripts/` (setup, dev, release, host) |
| L1 — Plugin hierarchy | The world registry that installs agents, prompts, and capabilities into the kernel | `apps/local/server/worlds.ts`, `prompts.ts`, `plugin.ts`, `agent-tools.ts` |
| L2 — Agent profiles | One readable profile per agent: the team builder plus spec mirrors of the product agents | `.opencode/agents/` |
| L3 — Skills | Focused instructions the runtime advertises when relevant | `.opencode/skills/` |
| L4 — Runtime instructions | Persistent guidance every session loads; workflow commands | `AGENTS.md`, `CONTRIBUTING.md`, `docs/RUNTIME.md`, `opencode.json`, `.opencode/commands/` |

L0 and L1 are code. L2–L4 are OpenCode files, profiles, skills, and instructions — the agent layer. The product runtime only reads L0/L1; contributor sessions load the agent layer and read L0/L1 as source.

## L0 — Runtime kernel

- `apps/local/server/` owns workspaces, jobs, pages, and agents. The product API binds to loopback; OpenCode is an embedded runtime, not a public coding-agent endpoint.
- `shastra-compute/` is the deterministic chart service (Swiss Ephemeris). Model inference never happens here.
- `scripts/` provides `setup`, `dev`, `release:check`, `project:context`, `project:check`, and host controls.

## L1 — Plugin hierarchy

The plugin (`intuitxn.iktara`) builds the product agent hierarchy at runtime:

```
world registry (worlds.ts)
├── page "reflection" ─ agent "iktara"      ─ prompt base + reflection suffix
└── page "chart"      ─ agent "iktara-chart" ─ prompt base + chart suffix
```

Each world declares its page id, agent id, label, and prompt. The plugin installs each registry agent as primary: reflection has 2 steps and no tools; chart has 4 steps and only the chart_evidence permission. It removes every non-registry agent, all built-in tools and MCP servers. The context hook exposes chart_evidence only to an active chart session with a server-owned job binding. A browser can select only a known page; it can never supply an agent, model, owner, tool, or system prompt. Profile/history are untrusted context. The no-argument chart_evidence tool invokes the original Python engine against the accepted job's immutable owned chart, method and topic; it caches one result per turn and is revoked on session exit or workspace clear. The tool returns a compact item/limitation view with short turn-local citation labels. The worker resolves those labels to this job’s exact evidence hash IDs, stores the full evidence alongside the answer and rejects missing, malformed or unknown references. See docs/EVIDENCE.md. The runtime starts in an isolated OpenCode config directory, so no personal config, credentials, plugins, or sessions leak into the product.

## L2 — Agent profiles

| Profile | ID | Owner | Purpose |
| --- | --- | --- | --- |
| `.opencode/agents/iktara-builder.md` | `iktara-builder` | Team | Primary coding agent; `opencode.json` default |
| `.opencode/agents/product/iktara.md` | `product/iktara` | Product runtime | Spec mirror of the reflection agent |
| `.opencode/agents/product/iktara-chart.md` | `product/iktara-chart` | Product runtime | Spec mirror of the chart agent |

The product profiles are runtime-spec mirrors. The plugin installs the running agents from `worlds.ts` + `prompts.ts`; the mirrors exist so the personas are readable and reviewable as files. They are hidden subagents with all tools denied, so they cannot be picked as coding agents.

## L3 — Skills

- `astro-engine` — the preserved astropersonalised engine: locations, parity rule, active vs preserved status.
- `product-runtime` — the world registry contract, plugin behavior, capabilities, and boundaries.
- `project-context` — the `project.json` source map, Buzz wiring, and handoff conventions.

## L4 — Runtime instructions

- `AGENTS.md` is the root working contract; OpenCode loads it automatically and combines it with nested `AGENTS.md` files when reading deeper paths.
- `opencode.json` sets the default agent (`iktara-builder`) and global guardrails: `.env.local`, `.runtime`, and `.runtime-dev` reads are denied; `git push` asks.
- `.opencode/commands/` provides `/verify`, `/project-context`, `/engine-check`, `/release`, and `/dev`.

## The astro engine is the prior astropersonalised engine

The engine in this repository must stay identical to the prior version from the astropersonalised repository (git remote `upstream` = https://github.com/Om2524/astropersonalised). Sources: `shastra-compute/src/core/`, `shastra-compute/src/engines/`, and `packages/astro-core/` (`packages/astro_core` symlinks to it).

- Parity check: `git fetch upstream && git diff upstream/main -- shastra-compute/src/engines shastra-compute/src/core packages/astro-core packages/astro_core` — expect no output. The `/engine-check` command runs this.
- Active: chart calculation (`ChartCalculator`, Swiss Ephemeris) through `src/core/calculator.py` and the chart router mounted by `src/local_app.py`.
- Candidate integration: Vedic/KP/Western/Compare are mounted through `/v1/evidence/extract` and exposed by the chart_evidence plugin. Production remains a separately verified revision; do not describe a branch build as live. The pinned baseline and inherited limitations are in docs/ENGINE-PARITY.md.
- A diff in `src/local_app.py` against upstream is expected (it is the local mounting file).

## Working with the runtime

1. Start from `AGENTS.md`, `CONTRIBUTING.md`, and the contributor prompt.
2. Change code and the agent layer together: a prompt change in `worlds.ts`/`prompts.ts` updates its `.opencode/agents/product/` mirror; a new engine or service update its skill; a new context file is added to `project.json`'s `context` list.
3. Verify with `/verify` (or `npm run project:check`, `npm --prefix apps/local test`, `npm --prefix apps/local run build`). Check engine parity with `/engine-check`.
4. Ship through the reviewed main + CI + host deployer path described in `docs/RELEASES.md`; prepare a release record with `/release`.

## Drift rules (violations are review blockers)

1. Engine sources differ from `upstream/main` (astropersonalised).
2. A product profile mirror differs from the composed prompt in `worlds.ts` + `prompts.ts`.
3. `npm run project:check` fails (missing context file, builder definition, or engine system).

## Buzz

The project is already registered in Buzz (`project.json` → `buzz.project`, `projectAddress`, channel `iktara`). Buzz holds requests, decisions, and reviewed handoffs; git holds executable context and prompts. See `docs/PROJECT.md`.

## Conversation storage and the chat entry flow

The public home and chat screens share one conversation view. Without a saved chart, questions use the reflection world; with a chart, they use the chart world. The UI names this distinction before sending. History includes both worlds, while inference receives only the latest 20 messages from its own world, each capped at 8,000 characters. The workspace API shows at most 100 recent messages and 30 jobs; this is not unlimited model memory or a complete transcript export.

The private product SQLite database persists questions, completed answers and reading evidence under a server-resolved browser owner. There are no authenticated accounts or cross-device recovery. The browser cookie expires after 30 days; losing it loses access. Expiry is not a data-deletion policy. Explicit workspace reset deletes the profile, chart, messages, jobs and evidence. Internal OpenCode sessions are short-lived and removed after inference; they are not the durable user transcript.

## Proposed infrastructure trigger service (not activated)

Reuse the existing agent-iktara coordinator with a separate private OpenCode coding service. An accepted task packet should freeze the Iktara task ID, source thread, requested outcome, repository base SHA and allowed actions. Deduplicate by task ID plus revision, work in an isolated branch/worktree, run repository checks and return a candidate SHA, preview and PR. Exact-candidate review remains the merge gate. Existing CI and the host watcher handle deployment and rollback; a verified receipt can then support an authorized Buzz update.

The coding service must have its own profile and scoped repository credentials. Customer agents retain their existing restricted capabilities and cannot trigger builds. Do not mount a public OpenCode coding endpoint or reuse customer transcript storage for infrastructure tasks. The Buzz trigger adapter, execution queue and service installation remain future work; this proposal does not activate them.

The public UI no longer exposes a reset-workspace control. The existing owned deletion API remains available. Two inference workers can process accepted jobs concurrently; queued work still persists across disconnects. Chart inference omits the duplicate raw chart from the initial model prompt and obtains its authoritative placements through the bound chart_evidence tool. Answers remain hidden until completion and citation validation; these changes do not make provider generation instantaneous.

## Birth profiles and chart explanations

Onboarding explicitly searches birthplace candidates via `/api/places`, then sends the selected coordinates and IANA timezone with the calculation request. The local adapter `shastra-compute/src/api/v1/local_chart.py` calls the preserved calculator. The original core and engine sources are unchanged. The legacy birthplace-only compute request remains supported. Search errors distinguish no result, upstream unavailability and invalid birth data. Onboarding no longer clears an existing saved chart before a replacement calculation succeeds.

The existing Nominatim provider is queried only on explicit search, with a bounded cache, one-request-per-second pacing, identifying User-Agent and visible OpenStreetMap attribution. `IKTARA_GEOCODING_URL` can override the operator-controlled upstream URL. See the [provider usage policy](https://operations.osmfoundation.org/policies/nominatim/). This is not an autocomplete API; deployments with multiple compute processes must share a lookup limiter/cache before scaling.

Successful chart creation awards a display handle stored in the owned `handles` table, with a unique username constraint. Username edits are validated and transactional, and changes to name/username preserve the chart. Handles do not authenticate people; email/mobile verification and recovery remain unimplemented. Birth data consists of local date/time (or unknown-time flag), selected birthplace/timezone and display name. Contact details are not needed for chart calculation.

The chart page offers an explicit Explain action through the existing chart world, bound evidence tool and durable jobs. It does not let an LLM calculate or alter placements. Explanations created before the current chart calculation are not reused as its overview. Old conversations remain historical records. Small interface transitions respect reduced-motion preferences.
