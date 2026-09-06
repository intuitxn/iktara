import { Plugin } from "@opencode-ai/plugin";
import { IKTARA_PROMPT } from "./prompts.js";

/** OpenCode v2 plugin: the product harness owns agents and available capabilities. */
export default Plugin.define({
  id: "intuitxn.iktara",
  async setup(ctx) {
    await ctx.agent.transform((agents) => {
      for (const agent of agents.list())
        if (String(agent.id) !== "iktara") agents.remove(String(agent.id));
      agents.update("iktara", (agent) => {
        agent.description =
          "A grounded companion for reflection and symbolic astrology";
        agent.system = IKTARA_PROMPT;
        agent.steps = 1;
        agent.permissions = [{ action: "*", resource: "*", effect: "deny" }];
      });
      agents.default("iktara");
    });
    await ctx.tool.transform((tools) => {
      for (const tool of tools.list()) tools.remove(tool.id);
    });
    await ctx.mcp.transform((servers) => {
      for (const [name] of servers.list()) servers.remove(name);
    });
    await ctx.session.hook("context", (context) => {
      context.tools = {};
      context.system = [{ type: "text", text: IKTARA_PROMPT }];
    });
  },
});
