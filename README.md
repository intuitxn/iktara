# Iktara

A space for personal reflection, with astrology as an optional lens. An Intuitxn product, based on [Om's original application](https://github.com/Om2524/astropersonalised).

## Run on your machine

Requires Node.js 22.22+, npm, and [uv](https://docs.astral.sh/uv/).

```sh
cd shastra-compute
uv sync --frozen --python 3.12
cd ../apps/local
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3210**. No Google sign-in, email login, subscription, or Convex account is needed. Birth charts work without an AI key. Conversation requires the model configuration described in [the local app guide](apps/local/README.md).

## Services

| Piece | Responsibility |
| --- | --- |
| `apps/local/src` | React interface; birth profile, chart, and conversation saved in the browser |
| `apps/local/server` | Product HTTP API, OpenCode v2 agent plugin, versioned prompts |
| `shastra-compute/src/local_app.py` | Local chart-only Python service using Swiss Ephemeris |
| `apps/local/scripts/start.mjs` | Starts and stops the local services together |

The product API binds to loopback on port 3210; chart computation binds to loopback on 8001 with a per-run service key. OpenCode is an embedded runtime, not a public coding-agent endpoint. Its configuration/state are separate from the operator's personal harness. Model credentials stay on the server.

The SDK/plugin development release is pinned; this is a local prototype, not a claim of a completed production migration. The existing `forsee.life` deployment is independent until its domain is connected to this host.

## Upstream application

`apps/web`, `convex`, `apps/email-service`, and the original Python reading routes preserve the earlier Cloudflare/Convex application for reference. They are not launched by the local product. Original tag deployment workflows are restricted to the upstream repository; the Intuitxn copy validates the local app instead.

## Team

Iktara owns the product and its runtime. [Telepathy](https://github.com/intuitxn/telepathy) owns the team's communication workflow. Share reviewed product changes and decisions there; keep credentials, birth details, and private conversations out of git and Buzz updates.
