# Iktara in Buzz

The project agent is **iktara-builder**. It owns implementation and verification in the Iktara repository. The customer agents (`iktara` and `iktara-chart`) remain inside the product runtime. Telepathy Prime can scope a request; Build can execute an accepted Desk job using Iktara's repository instructions; Steward can prepare the handoff. Those roles do not establish a connected Buzz bot identity by themselves.

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
