# Iktara working contract

The current Intuitxn product lives in `apps/local`. Start with README.md and apps/local/README.md. Keep product behavior in the agent plugin/prompts and model credentials in ignored local configuration.

This local hosting workflow supersedes the older production-only instructions in CLAUDE.md. Do not run upstream tag releases or modify the live forsee.life deployment as part of local development.

Before handing off runtime changes, run `npm test` and `npm run build` in apps/local. Use synthetic birth profiles for verification. Never commit `.env.local`, runtime databases, credentials, or private user conversations.

Shubham, Om, and Kush own product direction. Telepathy/Buzz is the team communication surface; requested code work does not itself authorize sending messages to people.
