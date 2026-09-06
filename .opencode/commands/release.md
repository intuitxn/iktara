---
description: Prepare a named release following the release record workflow
agent: iktara-builder
---
Follow docs/RELEASES.md. Update release.json with the version, changes, decision links, model, and limitations, then run `npm run release:notes` and `npm run release:check`. Prepare the draft release record and pull request; never tag, publish, or claim live deployment yourself.
