# Local Iktara

Run `npm ci`, `npm run build`, and `npm start` after `uv sync --frozen --python 3.12` in `../../shastra-compute`.

The launcher starts the chart service on 127.0.0.1:8001, creates a per-run service key, waits for readiness, then starts the product on **http://127.0.0.1:3210**. Stop with Ctrl-C. Ports 3000 and 8000 are already used on the current host.

## Model setup

Create an ignored `.env.local` beside this README, using `.env.example` as the template:

```dotenv
OPENCODE_MODEL=provider/model
OPENCODE_API_KEY=your-key
```

Use the provider and model supported by your OpenCode account. The optional `OPENCODE_INTEGRATION` can override the provider prefix used for credential registration when the account requires it. A Zen key and an upstream provider key are not interchangeable. Restart after changing configuration. No model/key is selected by default and no paid inference is performed until configured.

The key is loaded only by the backend and is never included in the browser bundle. OpenCode stores its private state under ignored `.runtime/`. Keep `.env.local` readable only by the machine owner. Do not add a `VITE_` prefix to secret variables.

## Harness and plugin

- `server/plugin.ts`: actual OpenCode v2 `Plugin.define` entry, agent and capability registration.
- `server/prompts.ts`: product system prompt and structured conversation context.
- `server/runtime.ts`: embedded `OpenCode.create`, model credential registration, isolated session lifecycle.
- `server/index.ts`: product API and static UI server.

SDK and plugin are pinned to `0.0.0-dev-19191`, with project-local Bun 1.4.2. This is the newer [OpenCode v2 SDK](https://opencode.ai/v2/docs/build/sdk), not the older v1 SDK's `/v2` HTTP client. Clone the repository to share the plugin and prompts. No global OpenCode configuration is changed.

Available routes: GET `/api/health`, POST `/api/chart`, POST `/api/chat`. The Python service exposes chart computation only. No shell, file, external-action, or MCP capabilities are available to product conversations. The operator can extend the plugin deliberately as new product services are added.

## Validation and limits

`npm test` exercises real v2 initialization, tool/MCP isolation, session removal, and HTTP boundaries. `npm run build` checks TypeScript and creates the browser bundle. A supplied model key is still required to verify actual model inference.

Profiles, charts, and conversation history persist in this browser until cleared. Chart requests send birthplace to the upstream Nominatim geocoder; messages and supplied chart/profile context go to the configured model provider. Server sessions are deleted after a request, but runtime database files are not a guarantee of forensic erasure.

This is a local prototype. Model spending controls, abuse protection appropriate to anonymous public traffic, backup/retention policy, and an external-domain smoke test remain production concerns. The public app endpoint has a global-per-local-proxy rate limit; it does not yet distinguish users behind Cloudflare Tunnel. The current pinned SDK has a transitive OpenTelemetry moderate dependency advisory; no automatic major-version downgrade was applied.

## Hosting on this Mac

The installed launch agent `com.intuitxn.iktara` starts the app at login and restarts it after failure. Logs are in `.runtime/host.stdout.log` and `.runtime/host.stderr.log`. Restart after an edit or key change:

```sh
launchctl kickstart -k gui/$(id -u)/com.intuitxn.iktara
```

The Mac must be awake and logged in. This does not yet provide public uptime. When Cloudflare access is available, route the intended hostname to `http://127.0.0.1:3210` through a named tunnel; keep the Python service private. Existing forsee.life hosting has not been changed.
