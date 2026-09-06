# Iktara — PRD and working agreement

Version: 0.1 · Status: draft for Shubham, Om, and Kush to review · Audience: Iktara project
Prepared by Codex from the project direction and repository evidence. This proposes a build plan; it does not record human acceptance or assign deadlines.

## Product outcome

Iktara helps a person ask a private astrology question, understand the calculated evidence behind the response, and explore a follow-up in the same context. The intended experience is question-first, similar to an answer engine: a readable answer with inspectable evidence, rather than an unexplained horoscope or a generic chatbot.

Astrology is a symbolic interpretive framework, not scientifically established prediction. The product must distinguish deterministic chart calculations, interpretive traditions, and model-written explanation. It must never invent placements or imply certainty about fate, health, or another person's thoughts.

## First user and core journey

Initial user: someone who wants to explore their own chart and a personal question privately. This is a proposed first audience, not a validated market claim.

1. Open Iktara without signup; start with a question or calculate a chart.
2. Enter birthplace, birth date, and birth time if known. Explain how the information is used.
3. Ask a question and choose an interpretive lens: Vedic, KP, Western, or Compare when supported by the evidence service.
4. Receive a concise explanation grounded in computed evidence. Expand evidence to inspect the relevant placement, calculation, engine/system, and uncertainty.
5. Ask a follow-up using the same owned profile/chart/history. Reconnect after loading or a interrupted browser session without losing an accepted job.
6. Clear personal workspace data. Do not imply account recovery or cross-device identity where none exists.

## MVP requirements and acceptance

### R1. Preserve the original engine

Use the calculator and engines from Om2524/astropersonalised. Identify an exact upstream revision and compare synthetic fixtures against it. Preserve engine behavior; changes to calculation semantics require an explicit reviewed decision. Vedic, KP, Western, and Compare must each have representative evidence. Unknown birth time, timezone conversion, and absent/invalid input must have defined outcomes.

### R2. Evidence service

Expose the existing engines through a documented product service contract. Each result should identify the calculation inputs used, engine/version, relevant evidence items, and limitations. User context and results must remain scoped to the requesting workspace. Coordinate the existing engine-sharing worktree rather than starting a duplicate implementation.

### R3. Grounded answers

OpenCode uses the selected DeepSeek V4 Flash model to explain engine evidence. The model does not replace the calculator. Answers reference supplied evidence IDs; a missing evidence result produces a clear limitation instead of invented claims. Compare explains differences between systems without manufacturing agreement. Verification must include the real answer-to-evidence flow with synthetic input and a cross-workspace access check.

### R4. Usable reading flow

Provide a private question, answer, evidence, follow-up loop on mobile and desktop. Show loading/reconnection, service failure, retry, missing-chart, and unknown-time states. Keep implementation details out of ordinary product copy; evidence provenance is visible where it helps the person understand a claim.

### R5. Reviewable delivery

A task carries its approved artifact version, owner, acceptance criteria, branch, and evidence. A reviewed GitHub main commit with successful push CI is prepared and activated by the installed host watcher. Record the actual running revision after deployment; a tag or passing build is insufficient evidence. Keep code, prompts, and context changes reviewable together.

## Current implementation versus target

Checked earlier in this session: main e97bef332345bec07f8e176399cee552450187b3 has the local app, original chart calculator, private browser workspaces, background jobs, and OpenCode readiness. The full original interpretation pipeline is not yet integrated in that running release. Separate engine-sharing and agent-layer work is in progress. PR #1 contains release/project-context work and targets main. Recheck these facts before implementation; this is a dated snapshot.

## Out of the first milestone

Public feed, selective sharing, invited family/community groups, payments, subscriptions, Google signup, collaborative customer sessions, and cross-device recovery. Sharing comes after private readings are reliable and a separate permission/data-lifecycle design is accepted. Do not silently add these requirements to Om's first task.

## One project agent

Use one visible project coordinator: **agent-iktara**. Preserve the existing identity when its mapping and editable settings are verified; do not create another bot to work around missing management access. The coordinator reads accepted PRD/task/artifact revisions, maintains the plan, prepares bounded work, and returns changes with evidence.

Codex or OpenCode can execute accepted code work in the task's Iktara worktree. Customer agents are separate product components, not additional team coordinators. A task assignment or workflow approval does not itself prove a runtime is connected. The current channel bot's editable management mapping remains unresolved.

## Proposed first tasks for Om

1. **Engine parity baseline.** Pin the upstream revision and produce synthetic input/output fixtures for all four systems. Ready when a reviewer can rerun the parity checks and understand any mismatch.
2. **Evidence integration.** After the baseline, coordinate the existing engine-sharing changes, implement the service contract, and connect owned evidence to the page agents. Ready when a synthetic question produces engine evidence, a grounded answer, and isolated stored results.
3. **Reading experience.** After the contract is stable, deliver the question → answer → expandable evidence → follow-up flow with honest uncertainty and recoverable errors. Ready when the agreed desktop/mobile flow works and the evidence matches its answer.

Shubham should confirm this scope and sequence with Om. These are proposed assignments, not a claim Om accepted them. Kush's role and delivery dates remain to be agreed.

## Artifacts as shared task context

An artifact is a durable deliverable with a stable reference: PRD, design, research note, prototype, test evidence, or release receipt. A hosted page is its human-readable view; Markdown/JSON and source files are the agent-readable version.

Every task context packet should contain: artifact ID and exact revision/hash; purpose; source links; accepted decisions; proposed/confirmed owner and reviewer; input/output contract; acceptance criteria; allowed scope; and expected evidence. A screenshot or an editable latest URL alone is not a reproducible task reference.

Example: give Om task R2 with PRD v0.1 plus its digest, engine fixture revision, service contract, relevant code paths, and acceptance checks. The coordinator uses the same packet, creates a candidate, and returns the changed files, test evidence, and exact commit. Accepted output becomes the next task's context.

For a hosted artifact site, use an access-controlled project page with a readable view and Markdown/JSON downloads. Keep a stable latest link for browsing and an immutable version link for work/review. Verify Om and Kush can access it and that the agent can retrieve the source. A separately hosted page does not automatically inherit Buzz membership. This draft is initially available as a Buzz project artifact/task; a separate artifact website and its permission/sync bridge are not implemented here.

## Workflow

Draft brief → agree task/context version → implement in worktree → review exact output → merge and CI → verify running revision → attach release receipt.

Buzz tracks the project and approval checkpoints. GitHub currently supplies CI and the deploy revision. Automatic Buzz/GitHub synchronization and workflow-to-runtime execution still need a bridge. Until then, an operator starts accepted work and attaches results explicitly. Keep all project discussion in #iktara and its threads.

## Sources

- Product direction and handoff: Buzz events 345395f56c6ea2d8b7fbc9bf508b51069a9b85d174e1b13b0f99a88f5312b4ee and 7870050866517cfb18c528bb05e1dfb20e005333d9a61cb667eaae50fbb54135 in Iktara.
- Product: https://github.com/intuitxn/iktara
- Prior app and engines: https://github.com/Om2524/astropersonalised
- Candidate review: https://github.com/intuitxn/iktara/pull/1
- Team runtime: https://github.com/intuitxn/telepathy
- Repository contracts: AGENTS.md, project.json, docs/PROJECT.md, docs/WORLD.md, ops/DEPLOYMENT.md.
