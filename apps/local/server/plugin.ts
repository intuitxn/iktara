import { Plugin } from "@opencode-ai/plugin";
import { WORLDS } from "./worlds.js";
import { registerAgentTools } from "./agent-tools.js";

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
          agent.steps = world.id === "chart" ? 4 : 2;
          agent.permissions = [{ action: "*", resource: "*", effect: "deny" },
            ...(world.id === "chart" ? [{ action: "chart_evidence", resource: "*", effect: "allow" as const }] : [])];
        });
      agents.default("iktara");
    });
    await registerAgentTools(ctx);
    await ctx.mcp.transform((servers) => {
      for (const [name] of servers.list()) servers.remove(name);
    });
    await ctx.session.hook("context", (context) => {
      const world =
        Object.values(WORLDS).find(
          (item) => item.agent === String(context.agent),
        ) || WORLDS.reflection;
      context.system = [{ type: "text", text: world.prompt }];
    });
  },
});
