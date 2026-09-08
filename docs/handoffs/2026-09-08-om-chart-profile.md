# Iktara handoff for Om

The owner requested the chat-first flow, original blue/glass appearance, no reset control, improved birth profiles, an agent explanation on the chart page, and merge of PR #4. The PR and GitHub main history identify the final revision; host activation must be checked separately.

Start with `git fetch origin`, then branch from `origin/main` in your own checkout/worktree. Run `npm run setup` and `npm run dev`; the contributor preview is on 3220 and production uses 3210. Do not copy production credentials or runtime databases. Read AGENTS.md and docs/RUNTIME.md before extending this work.

Public pages are in apps/web/app. Onboarding explicitly searches and selects a birthplace before calling /api/chart; successful calculation atomically saves the profile/chart and awards a username. Names and usernames can change without invalidating placements. Handles are not accounts: authentication, verified contact methods and recovery remain a separate product decision.

The chart page has a ChartGuide component using the same OpenCode v2 / DeepSeek V4 Flash chart world as chat. It calls only the bound chart_evidence tool. Deterministic calculations remain in the original Python engine. Do not add general coding tools or infra triggers to customer sessions. The separate infrastructure service is still a proposal.

Checks cover owned/unique usernames, failed chart edits, specific errors, explicit selected locations, birth-time uncertainty, original-engine parity, and bounded concurrent inference. Browser verification uses synthetic birth data. Keep the original color palette and reduced-motion support. Nominatim lookup is explicitly triggered and rate-limited; a shared limiter/cache is needed before adding compute replicas.

Continue with new scoped changes from main. No Buzz message or direct message has been sent as part of this handoff.
