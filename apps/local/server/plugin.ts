import { Plugin } from "@opencode-ai/plugin";
import { WORLDS } from "./worlds.js";

/** OpenCode v2 plugin: the product harness owns agents and available capabilities. */
export default Plugin.define({
  id: "intuitxn.iktara",
  async setup(ctx) {
    await ctx.agent.transform((agents) => {
      const allowed = new Set<string>(
        Object.values(WORLDS).map((world) => world.agent),
      );
      for (const agent of agents.list())
        if (!allowed.has(String(agent.id))) agents.remove(String(agent.id));
      for (const world of Object.values(WORLDS))
        agents.update(world.agent, (agent) => {
          agent.description = world.description;
          agent.system = world.prompt;
          agent.steps = 2;
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
      const world =
        Object.values(WORLDS).find(
          (item) => item.agent === String(context.agent),
        ) || WORLDS.reflection;
      context.system = [{ type: "text", text: world.prompt }];
    });
  },
});
