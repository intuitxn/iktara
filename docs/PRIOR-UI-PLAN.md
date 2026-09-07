# Plan: restore the prior product UI with a changed backend agent runtime

Owner direction (2026-09-07, Buzz #iktara): the hosted iktara (https://forsee.life)
keeps the current chat UI's poor design as its baseline. Use the prior product
itself — the original apps/web UI from the astropersonalized repo (upstream) —
with changes: the backend agent runtime stays grounded in the astropersonalized
code (shastra-compute engines + per-user OpenCode server), and the UI is adapted
for us (no cloud accounts, no subscriptions, Iktara branding).

## Target architecture

```text
Browser → forsee.life (cloudflared tunnel, unchanged)
            │
            ▼
        Next.js app (apps/web, prior product UI)  port 3210  PUBLIC
            │  rewrites /api/* → http://127.0.0.1:3211/api/*
            ▼
        apps/local Node runtime (OpenCode server per user)  port 3211  loopback
            │  chart calls → http://127.0.0.1:8001
            ▼
        shastra-compute Python chart service (Swiss Ephemeris)  port 8001  loopback
```

- The prior UI (apps/web) becomes the public front. Its design, components and
  i18n are kept; Convex, Polar, PostHog and the auth wall are removed.
- The backend agent runtime is the per-user OpenCode server (apps/local/server,
  DeepSeek V4 Flash) answering with engine evidence from the original
  Vedic/KP/Western/Compare engines (codex/iktara-private-readings runtime work).
- The deployment host (scripts/deploy-host.mjs) builds and boots all three
  services per candidate release; health checks and rollback behavior stay.

## Shared runtime API contract (UI ↔ runtime)

- GET  /api/health        → { ok, opencode, chart: { ready } }
- GET  /api/workspace     → { profile, chart, messages, worlds }
- PUT  /api/profile       → body { profile } → workspace
- POST /api/chart         → body { profile } → ChartResult
- POST /api/chat          → body { message, page, requestId?, method, domain }
                          → 202 { jobId }
- GET  /api/jobs/:id      → Job { status, text, evidence, method, domain }
- DELETE /api/workspace   → { ok }

Profile: { name, date_of_birth, time_of_birth, birthplace, birth_time_quality }
  birth_time_quality: exact | approximate | unknown
Method (lens): vedic | kp | western | compare
Domain (topic): per evidence.ts list.

## Work streams

- codex/prior-ui-web     — apps/web adapted to the contract above (no Convex/Polar/PostHog/auth).
- codex/prior-ui-runtime — apps/local/server aligned to the contract (evidence in jobs/messages).
- codex/prior-ui-host    — deploy-host.mjs, start.mjs, CI workflow: build/boot/serve the Next app.
- codex/prior-ui-restore — integration branch: merges the three streams, end-to-end build and boot check.

## Guardrails

- No push to main, no release tags, no live host activation, no Cloudflare
  dashboard changes until an owner reviews the PR and CI passes on main.
- No credentials in code, env files, or logs; no customer data.
- Production keeps running e97bef33 until reviewed activation.
