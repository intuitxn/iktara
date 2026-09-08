# Build Iktara together

Om, Kush, and Shubham can use Codex, OpenCode, or their editor. The same repository instructions, agent definitions, checks, and pull-request workflow apply to everyone.

## First run

```sh
git clone https://github.com/intuitxn/iktara.git
cd iktara
git switch -c your-name/your-change
npm run setup
npm run dev
```

Install Node.js 22.22+ and uv first. Setup installs the pinned project dependencies, checks the code, and builds the UI. Development runs on **http://127.0.0.1:3220**, with chart service 8020, so it cannot collide with the deployed app on 3210/8001. Re-run the build and restart development after changing server or UI code. You do not need a model key for builds, tests, or chart work. To test real replies, use your own ignored `apps/local/.env.local`; never request or copy the production key.

## Give your coding agent this prompt

> Read AGENTS.md, CONTRIBUTING.md, and docs/WORLD.md. Implement this change: [describe the user outcome]. Work on my branch, keep the product's no-signup flow and workspace isolation intact, and make the smallest complete change. Treat page behavior, agent prompts, and service boundaries as code. Run npm test and npm run build in apps/local, check the relevant browser flow using synthetic data, and prepare a pull request explaining the user-visible change and evidence. Do not deploy from my laptop, read production secrets, or message the team unless I ask.

The reusable prompt is in [docs/prompts/contributor.md](docs/prompts/contributor.md). Codex automatically reads the repository's [AGENTS.md](AGENTS.md), following its [documented instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md). With OpenCode v2, `iktara-builder` from `.opencode/agents/iktara-builder.md` is the default project agent (`opencode.json`); [Markdown agents](https://opencode.ai/v2/docs/agents) are native project configuration. Workflow commands live in `.opencode/commands/`, skills in `.opencode/skills/`, and the runtime contract is [docs/RUNTIME.md](docs/RUNTIME.md).

## Ship a change

For the Buzz decision loop, version tags, model/prompt release records, and shared development handoffs, read [docs/RELEASES.md](docs/RELEASES.md).

Push your branch and open a pull request. A teammate reviews the change; the `local` CI job must pass. Merge into `main`. The host deployer watches successful CI for the exact current main commit, prepares a new release, checks it, switches the running release, and restores the prior release if startup fails. See the deployment guide under `ops/` for host controls and recovery.

Only trusted changes merged into `main` run on the product host. Public pull requests run on GitHub-hosted workers and never receive the production environment. Changing a prompt follows the same CI/CD path as changing a page or service.

## What lives where

The public UI and browser interactions belong in `apps/web/app`; `apps/local/src` is the retained local-only interface. Build apps/web with `corepack pnpm --dir apps/web build` before running the contributor preview. Product worlds, agents, jobs, and workspace APIs belong in `apps/local/server`. Deterministic chart calculations belong in `shastra-compute`. Human decisions and reviewed updates belong in Telepathy/Buzz. User conversations and keys belong in private host state, never in the repository.
