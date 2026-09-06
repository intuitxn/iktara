---
description: Verify project context, runtime tests, and production build
agent: iktara-builder
---
Run `npm run project:check`, then `npm --prefix apps/local test`, then `npm --prefix apps/local run build`. Stop at the first failure and report the exact command output. If deployment scripts changed, also run `node scripts/deploy-host.test.mjs`. If startup changed, also run `node scripts/deploy-smoke.mjs .`.
