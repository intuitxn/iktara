---
description: Verify the astro engine still matches the prior astropersonalised version
agent: iktara-builder
---
Run `git fetch upstream`, then `git diff upstream/main -- shastra-compute/src/engines shastra-compute/src/core packages/astro-core packages/astro_core`. No output means the engine matches the prior astropersonalised engine at the current upstream/main revision. Report any diff as a violation of the engine parity rule in docs/RUNTIME.md; never edit engine sources silently. Also run `npm run project:check`.
