# Iktara 0.2.0 candidate verification

Date: 2026-09-06. Executor: Codex, owner-authorized implementation. This is evidence for review, not human acceptance or a production-release receipt.

## Source and artifact

- PRD v0.1: `136023349355c4cdc437cbbe95c4b65e4308d1b733f77ee1db396129d8f9c950` (draft assignment metadata preserved).
- Original-engine pin: `8485494f5cbfdd40b5dca578bfc2498974d7e118`.
- Candidate branch: `codex/iktara-private-readings`. Its exact commit belongs in the GitHub/Buzz handoff; changes after review require new verification.
- Separate engine-sharing worktree left intact; its wider sharing/memory changes are excluded.

## Automated checks

- 7 Python parity tests: upstream-generated fixtures for 3 synthetic charts × Vedic/KP/Western/Compare, component parity, timezone equivalence, unknown-time fallback, invalid input, preserved source bytes and dependency versions.
- 3 Python evidence-adapter tests: original outputs unchanged, stable reference envelopes, authentication, unsupported/incomplete input and limitations.
- 12 Bun tests: workspace ownership/durable jobs; evidence persistence, clearing and reference rejection; scoped tool binding/revocation/caching; actual OpenCode SDK initialization and HTTP boundaries.
- The SDK test uses a local scripted model (no paid inference) to prove the accepted session exposes only chart_evidence, serializes that tool into the model request, runs its bound closure exactly once and consumes its result. Reflection/unbound sessions expose no tools.
- Frontend typecheck/build, project-context check, release manifest/record tests, boot smoke and supervisor activation/rollback test passed.
- No diff in original core/engines/reference packages against the pinned upstream revision.

## Real synthetic reading and browser checks

Candidate served on local 3222/8022 using an isolated test workspace and the existing configured model. Health reported `opencode/deepseek-v4-flash`, ready.

Synthetic input: 2000-01-01 12:00, New Delhi, exact time. Western lens, Career topic. Initial end-to-end tests exposed two SDK integration defects: tools defaulted to CodeMode and later config rules overrode the tool allowance. Both were fixed without enabling general code execution; the regression now covers the actual path.

Successful reading job `0ad4873f-69a1-401c-86c8-6d9dccd555bb` returned 54 original-engine evidence items and a model answer. All references resolved to saved items; a manual check matched cited Sun/Saturn placement/aspect facts to their items. Follow-up job `4a0a84eb-987e-4c3d-aa8a-2f4f1f48b7da` also completed with 54 items and known citations. Reload restored both answers/evidence. The failed attempts showed Retry and retained method/topic; retry succeeded after the runtime fixes.

Desktop (1280px) and mobile (390px) screenshots were inspected: readable layout and expandable evidence/limitations/provenance, no horizontal overflow or framework overlay. A separate synthetic unknown-time chart was calculated. Another browser workspace received HTTP404 for the successful reading job; unauthenticated lookup returned401 during boundary verification. Cookies, raw sessions and model credentials are deliberately excluded from this artifact.

## Limits and release gate

These are bounded regression/flow checks, not proof of scientific accuracy, exhaustive model grounding, or all-device usability. Reference validation checks ID membership, not semantic entailment of every generated sentence. Real inference was sampled with Western/Career, not every method/topic/language combination. Unknown-time engine behavior remains inherited and explicitly qualified.

Public forsee.life and installed host were healthy on the older `e97bef332345bec07f8e176399cee552450187b3` when checked. The candidate has NOT been activated there. Required next gate: exact-candidate human review → main merge → successful exact-SHA CI → host activation → public synthetic verification. Do not tag/publish this as a completed live release before that gate.

Buzz coordinator activation, authenticated shared development sessions, general product-agent delegation, a separately hosted artifact site and automatic task-workflow/CI publication remain unconnected. Existing generic Desk automation is not that bridge; see TEAM-RUNTIME.md. Om's proposed assignments remain drafts.
