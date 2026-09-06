# Iktara in Buzz

**iktara-builder** is the repository's coding-agent definition, not proof of a running Buzz identity. The customer agents (`iktara` and `iktara-chart`) remain inside the product runtime. Telepathy can scope and execute accepted jobs using Iktara's repository instructions. Those roles do not establish a connected Buzz bot identity by themselves.

Live inspection on 2026-09-06 found an agent member in the Iktara channel with public-key label `051722e8…068f`; its readable identity, instructions, and runtime could not be verified from its profile. Attractor is separately configured as the Attri portfolio coordinator, not an Iktara-only expert. Do not rename, replace, or grant broader access to either identity to resolve this ambiguity. Verify the existing member's mapping first.

## Where work belongs

Manage Iktara tasks in the Buzz project itself: owner, status, acceptance criteria, linked branch/PR, agreed prompt, and reviewed handoff. Keep all Iktara updates, decisions, releases and handoffs in threads within `#iktara` only, not general forums or the global changelog. Do not create a duplicate task tracker. Git retains executable code and version history. Shared context means reviewed project sources, not customer conversations, credentials, or unrestricted access to the host.

No agent automatically knows everything about Iktara. Give the existing project agent this source map, the agreed task and decision links, and the exact checkout/deployed revisions; require it to distinguish preserved source, tested implementation, and live capability.

## Engine status checked on 2026-09-06

The active release checked was `e97bef332345bec07f8e176399cee552450187b3`.

- Original calculation engine: active. `local_app.py` mounts the existing chart router, which calls `src/core/calculator.py` (`ChartCalculator`, Swiss Ephemeris). The chart router, calculator, and engine sources match the checked `upstream/main` revision.
- Original Vedic/KP/Western/Compare interpretation pipeline: not active in that release. The original reading router extracts evidence through these engines; `local_app.py` does not mount it. The local product sends saved chart context directly to its OpenCode page agent instead.
- Language model: DeepSeek V4 Flash through OpenCode. Changing the language model does not replace deterministic calculations, but chart context alone does not restore the original evidence pipeline.

Preserve the original engines. Complete and review the separate integration work before describing the live product as having original reading-engine parity.

## Sources are project context

`project.json` is the versioned source map: Buzz project address, current and prior repositories, engine paths, agent definition, context files, and commands. Run `npm run project:context` to produce a sanitized JSON source map with the checkout revision, dirty flag, and file fingerprints. Run `npm run project:check` to validate its local references. It contains no user profiles or runtime conversations.

- Current code: https://github.com/intuitxn/iktara
- Prior repository: https://github.com/Om2524/astropersonalised (the `upstream` remote). Its original UI and Convex services remain in this repository.
- Calculation and interpretation engine: `shastra-compute/src/core` and `shastra-compute/src/engines`. Vedic, KP, Western, and Compare source is already here; a separate engine repository is not required.
- Product agent capabilities: `apps/local/server/plugin.ts`; page agents and prompts: `worlds.ts` and `prompts.ts` beside it.
- Team execution: https://github.com/intuitxn/telepathy. Accepted jobs use the product checkout/worktree and its instructions.

The full original evidence pipeline is not yet connected in this branch. Ongoing work in the `codex/iktara-engine-sharing` branch must be completed and reviewed separately; preserved source does not mean activated functionality.

## Change the running product from this checkout

1. Give `iktara-builder` the agreed outcome and source thread, plus `project.json` and the contributor prompt. Keep a branch and sanitized handoff for continuation.
2. Edit code, prompts, and context files together. Run `npm run project:check`, then the app tests and build. Update the release record when preparing a named release.
3. Push the branch for review. Reviewed main must pass the existing push CI workflow.
4. On the hosting Mac, run `npm run host:update` to check for that successful revision immediately, or let the five-minute watcher do it. This uses the installed operator and existing validation/rollback rules. It does not deploy uncommitted edits or merge a branch.
5. Run `npm run host:status` and inspect `/api/health`. Compare active revision to the intended commit; a successful poll can also mean no eligible update was available. Readiness alone does not prove a real model reply or public routing.

## Buzz connection

The live Iktara project has its product codebase attached. Link the prior repository and this source map there, and use the builder definition as the project agent's instructions. Creating/attaching an identity requires the owner's Buzz agent setup; a Markdown definition alone does not activate a relay agent. The CLI needs an authorized managed Buzz runtime. Never copy its signing key into this repository.

Requests, decisions and accepted handoffs belong in Buzz; executable context and prompts belong in Git. Ordinary channel discussion does not execute changes. This change does not send messages or install an automatic CI-to-Buzz publisher.
