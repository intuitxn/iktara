# Iktara local handoff

## Team update draft

Om, Kush — Iktara now has a separate Intuitxn repository with the original application history preserved. The simplified app runs on Shubham's Mac: no signup, optional birth chart, and a conversation interface. Its agent and prompts are code, using the OpenCode v2 SDK/plugin development release. Chart calculation is a separate local Python service.

Chart creation and the no-key experience have been checked in the browser. Runtime tests verify that the product agent has no personal harness tools or MCP connections. The next checks require the OpenCode model/key and Cloudflare routing; actual model replies and the public-domain migration have not been verified yet. The existing forsee.life deployment remains live.

Shubham's stated direction is to build Intuitxn products around fundamental human needs and emotions, in the vitamin category. Iktara is a concrete product to develop in that direction. Telepathy/Buzz remains the place for team communication and reviewed decisions.

## Working locations

- Repository: https://github.com/intuitxn/iktara
- Local app: http://127.0.0.1:3210
- Product prompt: `apps/local/server/prompts.ts`
- Agent plugin: `apps/local/server/plugin.ts`
- Setup and remaining limitations: `apps/local/README.md`

This is a draft for the team's communication channel; it has not been sent to Buzz.
