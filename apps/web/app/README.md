# iktara web app

Minimal Next.js UI for the Iktara runtime (OpenCode server on
127.0.0.1:3211). `next.config.ts` rewrites every `/api/*` request to
`http://127.0.0.1:3211/api/*`.

Dark night-sky design. All colors, spacing, and shared component styles
live in `app/globals.css` (design tokens at the top) and
`app/components/ui.tsx`. Pages use only those shared primitives.

## Screen map

- `app/layout.tsx` — shell: header with wordmark and nav, main container, footer.
- `app/page.tsx` — `/` landing: wordmark, tagline, CTA to onboarding.
- `app/onboarding/page.tsx` — `/onboarding` birth details form, saves via `PUT /api/profile`.
- `app/chart/page.tsx` — `/chart` profile summary, `POST /api/chart`, planet cards, raw JSON.
- `app/chat/page.tsx` — `/chat` reading UI: lens/topic selectors, `POST /api/chat`, polls `GET /api/jobs/:id`, renders evidence.
- `app/saved/page.tsx` — `/saved` lists workspace messages from `GET /api/workspace`, resets workspace.
- `app/lib/runtimeApi.ts` — typed client for the runtime API.
- `app/components/ui.tsx` — shared primitives: Button, Card, Field, Select, StatusPill, SectionTitle, Nav.
- `app/globals.css` — design tokens and shared styles.
- `app/error.tsx` — error boundary.

## Run

```sh
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm start -p 3210
```

The runtime must listen on `127.0.0.1:3211` for data requests.
