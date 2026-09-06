# Deploy trusted main merges to the Mac

The Mac polls `intuitxn/iktara` main every five minutes. It activates only an exact main SHA whose latest **push** run of `Iktara local app` (`local.yml`) succeeded. Pull requests run on GitHub-hosted runners; no self-hosted runner executes incoming PR code on this machine.

Each candidate gets a separate directory, frozen Node/Python dependency installs, runtime tests, a frontend build, real synthetic chart calculation, and a two-service boot check on temporary ports. A passing candidate becomes the atomic `current` symlink. The supervisor restarts both services, waits for chart and configured agent readiness, and returns to the previous healthy release if startup or continued health fails. This introduces a brief restart interruption; it is not zero-downtime deployment.

Protect main with required reviews and the `Test, build, and boot` check; restrict who can push or modify workflow/deployment code. CI success is not a substitute for trusted review: merged revisions execute package installation and application code as the hosting user. Do not use this host for untrusted contributions.

## Host layout

Default root: `/Users/a3fckxmini/.local/share/iktara-host`. Override with an absolute `IKTARA_DEPLOY_ROOT` in both launch agents if needed.

```text
iktara-host/
  bin/deploy-host.mjs        reviewed operator copy, not automatically replaced
  source.git/               main-only source cache
  releases/<40-char-sha>/    isolated candidate and built dependencies
  current -> releases/<sha> atomic release selection
  shared/.env.local         model settings, mode 600
  shared/runtime/           persistent OpenCode state, directory mode 700
  state.json                healthy active, previous, rejected SHA
  logs/                     private supervisor and polling logs
  paused                    optional automatic-deployment pause marker
```

The development checkout is never overwritten. Retained releases consume disk space; inspect status and manually archive unused exact release directories when needed. Keep current and previous. Runtime state is shared, so future database schema migrations require a separate migration/backup plan; code rollback cannot undo database migrations. This first setup runs the same pinned SDK/schema across releases.

## Bootstrap

From the development checkout, prepare the operator copy and shared configuration without printing credentials:

```sh
install -d -m 700 /Users/a3fckxmini/.local/share/iktara-host/bin
install -m 700 scripts/deploy-host.mjs /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs
node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs status
install -m 600 apps/local/.env.local /Users/a3fckxmini/.local/share/iktara-host/shared/.env.local
node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs poll
```

Do not overwrite an existing shared `.env.local` during routine code updates. The copy above is only for initial bootstrap. After successful selection, the launch-agent commands are:

```text
/Users/a3fckxmini/.local/bin/node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs serve
/Users/a3fckxmini/.local/bin/node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs poll
```

Use `PATH=/Users/a3fckxmini/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin` in each plist. Confirm that uv is available there before bootstrap. After writing the reviewed supervisor and poller plists to `~/Library/LaunchAgents`, load them with `launchctl bootstrap gui/$(id -u) <absolute-plist-path>`; remove the older loaded product agent with `launchctl bootout gui/$(id -u)/com.intuitxn.iktara` immediately before loading its replacement. The poller must not use KeepAlive.

1. Ensure Node 22.22+, npm, git, tar, and uv are on the launch agents' explicit PATH. On this host tools are in `/Users/a3fckxmini/.local/bin`.
2. Copy reviewed `scripts/deploy-host.mjs` to `<host-root>/bin/`. Run `node <host-root>/bin/deploy-host.mjs status` once to create protected directories. This script intentionally does not update its installed copy from future commits.
3. Copy configured ignored `apps/local/.env.local` to `<host-root>/shared/.env.local` with permissions 600. Keep credentials out of plists and git. The supervisor passes `IKTARA_ENV_FILE` and `IKTARA_RUNTIME_DIR` to the launcher.
4. Push approved implementation to main and wait for successful `Iktara local app` push CI. Run `node <host-root>/bin/deploy-host.mjs poll`. It validates the exact revision before selecting it. If CI has not succeeded, nothing changes.
5. Stop the earlier `com.intuitxn.iktara` launcher before starting the supervisor on its ports. Replace its launch agent with `ProgramArguments` equal to the absolute Node path, `<host-root>/bin/deploy-host.mjs`, and `serve`. Set `RunAtLoad=true`, `KeepAlive=true`, `ThrottleInterval=15`, and private log paths under `logs/`.
6. Install `com.intuitxn.iktara.deploy` using the same executable paths plus `poll`, with `RunAtLoad=true`, `StartInterval=300`, and **no KeepAlive**. Set the same deployment-root and PATH environment in both; use separate poll logs.
7. Verify `status`, `http://127.0.0.1:3210/api/health`, and frontend. A configured model should report `opencode.ready=true`; this verifies runtime initialization/key registration, not paid inference. Separately verify a real reflection after configuring the key.

Public GitHub reads need no token at this polling interval. If rate limits or private-repository access require authentication, the poller supports `GH_TOKEN` for API reads; git HTTPS separately needs a credential helper. Never put tokens in a remote URL, command arguments, or logs.

The Mac must be awake and logged in. Cloudflare Tunnel should target `http://127.0.0.1:3210`; compute and smoke-test ports stay private. DNS/tunnel setup is a separate operator step.

## Operations

```sh
node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs status
node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs poll
node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs pause
node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs rollback
node /Users/a3fckxmini/.local/share/iktara-host/bin/deploy-host.mjs resume
```

`pause` preserves the app. `rollback` selects the previous healthy release and pauses deployment so the same main revision cannot immediately replace it. Automatic rollback records the rejected SHA and does not retry it; publish a corrected new commit. If the first release fails, no earlier release exists, so deployment pauses for operator inspection. The original development checkout remains available.

Failed preparations leave current unchanged. The next poll moves an inactive, operator-owned incomplete candidate to an exact `.failed-<timestamp>` directory and retries, up to three attempts per SHA. After that, inspect retained logs/candidates and publish a corrected commit or deliberately reset that SHA's attempts file. Nothing is recursively deleted. Lock files contain PIDs; stale locks are reclaimed only when that process no longer exists.

After editing shared environment/key settings, restart the supervisor with its launch-agent label. Do not put settings inside releases. CI and preflight do not make paid model calls: smoke checks clear inherited credentials, use isolated temporary runtime state, stop their process group, and remove only their own temporary directory.
