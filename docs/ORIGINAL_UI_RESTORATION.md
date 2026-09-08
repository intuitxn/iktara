# Original UI restoration — review candidate

Prepared 2026-09-08 on `codex/original-astro-ui`, based on main `2a551962489c3b07697f70727da0fe492883a006`. This document describes a candidate, not a live deployment receipt.

## Source and behavior

Visual source: `Om2524/astropersonalised` commit `8485494f5cbfdd40b5dca578bfc2498974d7e118`. The original logo asset, sky-blue gradient/glass CSS, landing composition, question composer, and detailed birth-chart presentation are restored/adapted from that commit. The prior replacement's dark theme and header-based chat are removed.

The new API continues to own anonymous workspaces, charts, durable reading jobs and saved answers. The UI provides all four supported lenses and explicit topics, Markdown answers, clickable numbered chart sources, original-engine provenance, follow-up questions, saved reading expansion, retry and reload recovery. Onboarding saves the profile and calculates its chart before entering chat. No chart silently falls back to generic reflection.

The original engines remain byte-identical. The chart screen labels dasha as the birth period and hides houses/ascendant for unknown time. The selected model remains DeepSeek V4 Flash through OpenCode v2.

## Citation reliability

A synthetic real-model comparison returned an invalid long hash reference during verification. The candidate now sends a compact view of evidence items and limitations, with short per-question labels. The worker resolves those labels to exact hash IDs against the immutable job evidence before saving. Missing, malformed and unknown labels still fail closed; no automatic paid retry or substituted evidence is introduced. Full evidence remains stored with the answer.

## Verification

- Original-engine parity: 7 tests, including pinned source bytes, all four engine outputs, timezone equivalence and unknown-time behavior.
- Evidence adapter: 3 tests.
- Runtime: 15 tests, including cross-workspace isolation, durable jobs, actual v2 tool boundaries, short-label resolution and persistence of canonical evidence IDs.
- Both frontend builds, project check, release manifest checks, deployment startup smoke and host rollback test.
- Synthetic browser onboarding and chart calculation; real Compare answer with source expansion; Western follow-up; reload during accepted inference; saved answer/provenance inspection.

Mobile verified at 390px: onboarding, question composer, navigation, saved source links and unknown-time chart; no page-level horizontal overflow. Candidate CI results are recorded in the pull request. Synthetic fixtures only; no customer profiles, cookies, model keys or raw runtime sessions belong in this artifact.

## Boundaries

This is the private reading experience from the existing product milestone. Daily/weekly forecasts, current transit computation, web search, paid plans, Google signup, shared customer threads and cross-device recovery are not activated. Citation validation establishes traceability, not semantic proof of every interpretation. Browser extensions such as Dark Reader can recolor the original light design.

## Review and release

Review the exact PR revision, merge after approval and successful CI, then allow the installed host watcher to prepare and activate that main revision. Check active SHA and public browser behavior before describing the restoration as live. The contributor preview is on port 3220, with web 3221 and compute 8020; production stays isolated on 3210/3211/8001.
