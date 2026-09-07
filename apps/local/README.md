# Local Iktara

From the repository root, run `npm run setup`, then build the Next frontend once with `cd apps/web && corepack pnpm install && corepack pnpm build`, then `npm run dev`. The contributor instance is **http://127.0.0.1:3220**, separate from deployed port 3210. `npm run dev` boots three services: the Next app on port 3220, this runtime on 3211, and the chart service on 8020; do not run it on the same machine as a deployed host. See [CONTRIBUTING](../../CONTRIBUTING.md).

## Model setup

Use an ignored `.env.local` beside this README, based on `.env.example`:

```dotenv
OPENCODE_MODEL=opencode/deepseek-v4-flash
OPENCODE_API_KEY=your-opencode-zen-key
```

DeepSeek V4 Flash is the selected model. Restart after configuration changes. Keep the file mode 600 and never add a `VITE_` prefix to a secret. The server registers the key with its isolated OpenCode integration; it never reaches the browser bundle.

The deployed instance reads private `shared/.env.local` and stores databases under `shared/runtime` outside release directories. The development instance has its own `.runtime-dev`. `npm start` launches all three services: the Next app on `PORT` (default 3210), this runtime on `RUNTIME_PORT` (default 3211, loopback), and the chart service on `COMPUTE_PORT` (default 8001, loopback); do not run it alongside the deployed host. The launcher supports `IKTARA_ENV_FILE`, `IKTARA_RUNTIME_DIR`, `PORT`, `RUNTIME_PORT`, and `COMPUTE_PORT`. The web app's `/api/*` rewrite targets port 3211 and is baked at build time, so keep `RUNTIME_PORT` at 3211 (override only for emergencies, together with a rebuilt web app that targets the same port).

## World and runtime

- `server/worlds.ts`: reflection and chart page definitions, agent IDs, intent, and prompts.
- `server/plugin.ts`: OpenCode v2 page agents with a scoped chart_evidence capability, no coding tools or MCP servers.
- `server/prompts.ts`: shared product behavior and structured context.
- `server/workspace.ts`: owner-filtered SQLite profile, chart, history, and job storage.
- `server/jobs.ts`: background worker; accepted requests survive browser disconnection.
- `server/runtime.ts`: embedded OpenCode, per-owner execution directories, short-lived inference sessions.
- `server/index.ts`: HTTP API (loopback behind the Next app's `/api/*` rewrite).

SDK/plugin are pinned to `0.0.0-dev-19191`, with project-local Bun 1.4.2. This is the newer [OpenCode v2 SDK](https://opencode.ai/v2/docs/build/sdk), not the older v1 SDK's `/v2` client. Reflection uses 2 steps and no tools. Chart uses 4 steps and only the no-argument chart_evidence capability; the model must call it before answering. Every call is bound to the accepted job's private context, cached per turn and revoked on session exit.

## Data and API

An opaque HttpOnly cookie identifies an anonymous browser workspace. This is not a verified person/account and provides no cross-device recovery. Profiles, charts, messages, and jobs are stored on the host, scoped to the server-resolved owner. Clearing the workspace removes its product data; clearing only cookies loses access. The cookie expires after 30 days. There is no automated expired-workspace purge yet.

GET `/api/workspace` opens/restores the workspace. PUT `/api/profile` saves its profile. POST `/api/chart` calculates and saves its chart. POST `/api/chat` accepts `{message,page,requestId?,method?,domain?}` and returns `202 {jobId}`. GET `/api/jobs/:id` returns only the caller's job. DELETE `/api/workspace` clears the caller's data. GET `/api/health` reports service readiness.

Chart readings require a saved chart; method is vedic/kp/western/compare (default compare), topic defaults to general and is explicitly selected, not automatically classified. Saved messages/jobs include method, domain and the exact private evidence bundle for successful answers. See ../../docs/EVIDENCE.md. Reflection and Chart have distinct histories. The backend supplies profile/chart/history to the model; clients cannot impersonate a user by sending an ID. Queued jobs resume after restart; interrupted inference becomes an explicit error for retry rather than silently making a second paid request. Reloading the UI reconnects to saved jobs and responses.

Birthplace is sent to Nominatim for geocoding. Messages and relevant profile/chart context go to OpenCode's configured model provider. OpenCode execution sessions are removed after each request, but deletion is not a guarantee of forensic erasure from database files. No private context belongs in git or Buzz.

## Hosting and verification

[Deployment operations](../../ops/DEPLOYMENT.md) cover the CI watcher, isolated releases, restart, rollback, and private state. The Mac must be awake and logged in. A named Cloudflare tunnel must target port 3210, with `IKTARA_PUBLIC_ORIGIN` set to its HTTPS origin, before the public domain can use this runtime.

`npm test` exercises actual v2 agent/capability initialization, owner isolation, durable queue recovery, and HTTP boundaries. `npm run build` checks types and bundles the static UI. CI also builds apps/web and boots all three services (Next app, runtime, chart service) and checks real chart calculations without a model key. Real DeepSeek inference is verified separately; it is not billed on every build.

This remains an early product: public abuse/spending controls, cross-device identity, retention policy, backups, and external-domain verification need explicit operational decisions. The pinned SDK has a moderate transitive OpenTelemetry advisory; no incompatible automatic downgrade was applied.
