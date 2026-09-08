# Private reading evidence contract

Status: candidate implementation, not a deployment receipt. PRD v0.1 R1–R4. Original engine sources are pinned to `8485494f5cbfdd40b5dca578bfc2498974d7e118`; see ENGINE-PARITY.md.

## Runtime flow

Browser-owned workspace → accepted immutable job context → OpenCode chart agent → no-argument chart_evidence plugin → authenticated loopback Python adapter → original selected engine → cited answer → owned durable result.

The model is `opencode/deepseek-v4-flash`. Python performs no inference. The adapter reuses the evidence boundary developed in the separate engine-sharing worktree; sharing, web search and semantic memory changes there remain untouched and excluded.

This preserves the original chart → selected engine → evidence → explanation flow. The local product intentionally uses an explicit lens/topic instead of the legacy Gemini QueryRouter. Topic defaults to general; it is not inferred automatically. The original AnswerComposer's direct-answer/reasoning/limitations/follow-up structure informs the versioned chart prompt; its old provider and unsupported upcoming-transit request are not activated.

## Service contract

`POST /v1/evidence/extract`, loopback only, requires `X-API-Key`. Input: `{chart, query, method, domain}`. Method is vedic/kp/western/compare. Domain is one of the exported product enums. The chart is the server-owned snapshot, never a browser/model-selected arbitrary chart. Invalid or incomplete snapshots return 422.

Output includes schema_version, id, engine_revision, chart_digest, chart_snapshot, method, domain, birth_time_quality, original raw evidence, limitations and items `{id, system, kind, detail}`. SHA-256 IDs identify exact items and the engine/chart/topic that produced them. The product additionally attaches the calculation's birth-date/time/quality/coordinates/timezone inputs inside private storage. No name or birthplace string is needed in the evidence inputs.

Items wrap original fields without changing engine rules. They include both calculated positions and traditional interpretation/heuristic summaries; an ID is provenance, not scientific support. Results retain the original rule limitations: dasha is at birth, KP day-lord follows computation weekday, uncertain time makes houses/ascendant/time-sensitive interpretation unreliable. No current transit data is included.

## Job and session boundaries

The accepted job freezes owned profile/chart/history, requested method/topic and calculation inputs. Tool bindings use internal session ID + owner + chart agent; there are no arguments for owner, chart, URL, query or lens. Duplicate calls reuse one extraction. Unknown/reflection/closed sessions receive no tool. Clearing a workspace revokes active bindings; deleted jobs cannot recreate results.

The model receives a compact view of the returned items and limitations with turn-local `[S1]` citation labels, without duplicate raw engine/chart payloads. The worker resolves each label against this job’s immutable items to its exact `[E-…]` hash ID before saving. Unknown or malformed labels fail closed; no automatic inference retry is made. Successful saved chart answers contain supplied `[E-…]` references and no unknown reference IDs. Missing evidence or a failed reference check fails the job and invites retry, without silently generating an unsupported fallback or repeating a paid inference call. This check verifies references only, not semantic entailment of each sentence. Human synthetic-reading review remains required.

The additive `reading_jobs` table stores method/topic/evidence, with owner checks and foreign-key deletion alongside jobs. Older databases need no destructive migration. Rolling back code leaves this additive table intact; clearing data cascades through jobs. This is not forensic erasure, and there is no new retention policy or cross-device recovery.

The product keeps durable messages/jobs/evidence; short-lived OpenCode execution sessions are removed after each answer. Team shared development sessions, named customer threads, general delegation and account/group sharing are separate future work, not implied by server hosting.

## Verification

Run both Python suites (`parity*.py` and `test*.py`), `npm --prefix apps/local test`, `npm --prefix apps/local run build`, project/release checks and the deployment smoke. Real model verification is separate and uses synthetic data only. Test missing chart, unknown time, all engine outputs, valid/invalid citations, reload, follow-up, failure/retry, cross-workspace denial and clear. Keep private test cookies and model configuration out of evidence artifacts.
