# Iktara: decisions, development, and releases

Product name: **Iktara**. Organization: **Intuitxn**. Repository: `intuitxn/iktara`.
Intended public address: `https://forsee.life`. That address is not evidence that this new runtime has been routed there.

## Team loop

1. Open an Iktara change thread in the verified Intuitxn Buzz forum. Record the user outcome, owner, acceptance criteria, and a decision needed from Om, Kush, or Shubham.
2. Link the thread from a feature branch/PR. Use `npm run setup` then `npm run dev` (port 3220). Give Codex or OpenCode `docs/prompts/contributor.md` plus the agreed brief. The deployed app stays on 3210.
3. Share the prompt changes and a deliberately written session handoff using `docs/templates/session-handoff.md`. Link the exact revision, PR and test evidence. Do not export raw runtime sessions.
4. A human teammate reviews the exact change. Passing CI and a reviewed merge to main trigger the existing host deployer. Buzz discussion alone cannot execute code or bypass GitHub review.
5. For a named release, update `release.json` in the PR: semantic version, changes, decision links, model and limitations. Patch = fixes/prompt tuning; minor = additive product capability; major = incompatible contract. Prompt changes are product changes, not invisible configuration edits.
6. After main's CI passes, run **Prepare Iktara release** from GitHub Actions on main. It creates a **draft** `iktara-vX.Y.Z` release with exact SHA and prompt/agent SHA-256 fingerprints. It does not deploy, post to Buzz, or claim live status. Review the draft and publish using GitHub Releases. Never move a published tag; issue a new version.
7. Verify the host's active revision, actual configured model, health, and a synthetic user flow. Verify the public domain separately. Post the accepted release with its real deployment status in the original Buzz thread using the release-post template.

GitHub supports draft release review before publication: [official release guide](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

## Buzz connection

Telepathy documents an `iktara` project/home stream and the `intuitxn-general` forum. Live IDs and membership must be verified before posting. The existing Desk queue emits forum posts, not stream messages: do not route it to the stream by guessing a name or UUID.

From the sibling Telepathy checkout, in an authorized Buzz runtime:

```sh
npm run desk -- doctor
npm run desk -- queue VERIFIED_FORUM_UUID /absolute/path/to/reviewed-release.md
npm run desk -- send OUTBOX_ID DIGEST
```

Use the actual queue result's ID and digest; read the exact text before sending. The current Iktara workflow produces release artifacts; **an automatic CI-to-Buzz sender is not connected**. This intentional review boundary keeps build logs, secrets, and unaccepted claims out of company announcements. The actual Buzz signing identity is separate from the human approving a release.

## Shared sessions and access

Share accepted context, not unrestricted production access. The repository makes product prompts, agent definitions, tests and sanitized handoffs available to contributors. Telepathy's private ledger maps development jobs to their own worktrees/runtime sessions. Om and Kush can continue from a reviewed handoff on their own branch/runtime now.

Live collaborative access to the same OpenCode session is **not implemented**. It requires authenticated team membership, per-project authorization, session/worktree ownership, and an audit trail. Never expose the customer OpenCode runtime or personal Mac workspace as a public coding server. Customer birth details, private conversations, model keys, raw transcripts and runtime database contents are not shared team artifacts.

## Public cutover

Cloudflare access is required. Follow the [Cloudflare Tunnel setup guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), using the product service at `http://127.0.0.1:3210` as origin. Record the current DNS/route first for rollback, set the private host's `IKTARA_PUBLIC_ORIGIN=https://forsee.life`, restart and verify, then switch the route and test HTTPS/cookies/real replies from outside the Mac. Do not route chart ports, smoke-test ports, or a raw agent API publicly. Existing `forsee.life` remains unchanged until that authenticated operation is performed.
