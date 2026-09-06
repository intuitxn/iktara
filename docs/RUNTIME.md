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

Each world declares its page id, agent id, label, and prompt. The plugin sets a step limit of 2, denies all permissions, and installs each registry agent as primary. It also removes every agent not in the registry, removes all tools from product sessions, removes MCP servers, and rewrites session context to the page prompt with an empty tool set. A browser can select only a known page; it can never supply an agent, model, owner, tool, or system prompt. Profile and chart context are injected as untrusted data, never as capability tools. The runtime starts in an isolated OpenCode config directory, so no personal config, credentials, plugins, or sessions leak into the product.

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
- Preserved, not mounted: the Vedic/KP/Western/Compare reading-evidence pipeline under `src/engines/`. Do not describe the live product as having reading-engine parity until that integration is completed and reviewed.
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
