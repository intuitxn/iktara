# Iktara: decisions, development, and releases

Product name: **Iktara**. Organization: **Intuitxn**. Repository: `intuitxn/iktara`.
Public address: `https://forsee.life`. On 2026-09-06 the new runtime was verified over HTTPS with a real model reply, Secure/HttpOnly cookie, and cross-workspace job denial. This is a dated verification, not a guarantee of current uptime.

## Team loop

1. Open or continue the relevant thread in `#iktara` only. Record the user outcome, owner, acceptance criteria, and a decision needed from Om, Kush, or Shubham. Keep updates, changelog and handoffs in that channel; do not cross-post to general forums or the global changelog.
2. Link the thread from a feature branch/PR. Use `npm run setup` then `npm run dev` (port 3220). Give Codex or OpenCode `docs/prompts/contributor.md` plus the agreed brief. The deployed app stays on 3210.
3. Share the prompt changes and a deliberately written session handoff using `docs/templates/session-handoff.md`. Link the exact revision, PR and test evidence. Do not export raw runtime sessions.
4. A human teammate reviews the exact change. Passing CI and a reviewed merge to main trigger the existing host deployer. Buzz discussion alone cannot execute code or bypass GitHub review.
5. For a named release, update `release.json` in the PR: semantic version, changes, decision links, model and limitations. Patch = fixes/prompt tuning; minor = additive product capability; major = incompatible contract. Prompt changes are product changes, not invisible configuration edits.
6. After main's CI passes, run **Prepare Iktara release** from GitHub Actions on main. It creates a **draft** `iktara-vX.Y.Z` release with exact SHA and prompt/agent SHA-256 fingerprints. It does not deploy, post to Buzz, or claim live status. Review the draft and publish using GitHub Releases. Never move a published tag; issue a new version.
7. Verify the host's active revision, actual configured model, health, and a synthetic user flow. Verify the public domain separately. Post the accepted release with its real deployment status in the original Buzz thread using the release-post template.

GitHub supports draft release review before publication: [official release guide](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

## Buzz connection

The sole Iktara destination is channel `78fedf61-f8e2-43df-9413-37d98d6a430a` (`iktara`). Verify membership before posting. The consolidated update root is `7870050866517cfb18c528bb05e1dfb20e005333d9a61cb667eaae50fbb54135`; the release log and continuation handoff are in its thread. Do not distribute Iktara material across `intuitxn-general`, `telepathy`, or the global `changelog`.

In an authorized Buzz runtime, after reviewing the exact message:

```sh
buzz --relay https://intuitxn.communities.buzz.xyz messages send \
  --channel 78fedf61-f8e2-43df-9413-37d98d6a430a --kind 9 \
  --reply-to 7870050866517cfb18c528bb05e1dfb20e005333d9a61cb667eaae50fbb54135 \
  --content - < /absolute/path/to/reviewed-update.md
```

Record the accepted event receipt. A transport timeout is not proof of failure: check the thread before retrying to avoid duplicates. The existing Desk forum-only queue must not be used for this stream until it supports the correct channel/thread routing. The current Iktara workflow produces release artifacts; **an automatic CI-to-Buzz sender is not connected**. Keep build logs, secrets, and unaccepted claims out of announcements. The actual Buzz signing identity is separate from the human approving a release.

## Shared sessions and access

Share accepted context, not unrestricted production access. The repository makes product prompts, agent definitions, tests and sanitized handoffs available to contributors. Telepathy's private ledger maps development jobs to their own worktrees/runtime sessions. Om and Kush can continue from a reviewed handoff on their own branch/runtime now.

Live collaborative access to the same OpenCode session is **not implemented**. It requires authenticated team membership, per-project authorization, session/worktree ownership, and an audit trail. Never expose the customer OpenCode runtime or personal Mac workspace as a public coding server. Customer birth details, private conversations, model keys, raw transcripts and runtime database contents are not shared team artifacts.

## Public cutover

The initial cutover has been verified. Do not repeat it during ordinary development. For recovery or a future host move, follow the [Cloudflare Tunnel setup guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), using the product service at `http://127.0.0.1:3210` as origin. Record the current DNS/route first for rollback, configure `IKTARA_PUBLIC_ORIGIN=https://forsee.life`, and verify HTTPS/cookies/real replies after routing. Never expose chart ports, smoke-test ports, or a raw agent API. The Mac must remain awake and the hosting services running.
