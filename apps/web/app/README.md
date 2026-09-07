# iktara web app

Minimal Next.js UI for the Iktara runtime (OpenCode server on
127.0.0.1:3211). `next.config.ts` rewrites every `/api/*` request to
`http://127.0.0.1:3211/api/*`.

## Screen map

- `app/layout.tsx` — page shell: header with nav (Home / Onboarding / Chart / Chat / Saved).
- `app/page.tsx` — `/` landing page.
- `app/onboarding/page.tsx` — `/onboarding` birth details form, saves via `PUT /api/profile`.
- `app/chart/page.tsx` — `/chart` shows the saved profile, computes via `POST /api/chart`, renders the result.
- `app/chat/page.tsx` — `/chat` reading UI: sends `POST /api/chat`, polls `GET /api/jobs/:id`.
- `app/saved/page.tsx` — `/saved` lists workspace messages from `GET /api/workspace`.
- `app/lib/runtimeApi.ts` — typed client for the runtime API.
- `app/globals.css` — Tailwind import and small shared styles.
- `app/error.tsx` — error boundary.

## Run

```sh
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm start -p 3210
```

The runtime must listen on `127.0.0.1:3211` for data requests.
