import type { Plugin } from "@opencode-ai/plugin";

export interface EvidenceBinding {
  owner: string;
  agent: "iktara-chart";
  evidence: () => Promise<unknown>;
}

/** Authority comes from the accepted job, never model arguments or history. */
export class AgentToolSessions {
  private readonly sessions = new Map<string, EvidenceBinding & { result?: Promise<unknown> }>();

  bind(sessionID: string, binding: EvidenceBinding): () => void {
    if (!sessionID || !/^[0-9a-f-]{36}$/.test(binding.owner) || binding.agent !== "iktara-chart" || typeof binding.evidence !== "function" || this.sessions.has(sessionID))
      throw new Error("Invalid or duplicate evidence binding");
    const entry = { ...binding };
    this.sessions.set(sessionID, entry);
    return () => { if (this.sessions.get(sessionID) === entry) this.sessions.delete(sessionID); };
  }

  allowed(sessionID: string, agent: string): string[] {
    return this.sessions.get(sessionID)?.agent === agent ? ["chart_evidence"] : [];
  }

  clearOwner(owner: string): void {
    for (const [id, binding] of this.sessions) if (binding.owner === owner) this.sessions.delete(id);
  }

  async execute(sessionID: string, agent: string, raw: unknown): Promise<unknown> {
    const binding = this.sessions.get(sessionID);
    if (!binding || binding.agent !== agent) throw new Error("Evidence is unavailable in this session");
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length)
      throw new Error("chart_evidence accepts no arguments");
    // Cache the in-flight promise as well as success/failure: one extraction per turn.
    binding.result ??= Promise.resolve().then(() => {
      if (this.sessions.get(sessionID) !== binding) throw new Error("Product session has ended");
      return binding.evidence();
    });
    const result = await binding.result;
    if (this.sessions.get(sessionID) !== binding) throw new Error("Product session has ended");
    return result;
  }
}

export const agentToolSessions = new AgentToolSessions();

/** Sole product capability; no owner/query/lens/chart/destination selectors. */
export async function registerAgentTools(ctx: Plugin.Context, sessions = agentToolSessions): Promise<void> {
  await ctx.tool.transform((tools) => {
    for (const tool of tools.list()) tools.remove(tool.id);
    tools.add({
      name: "chart_evidence",
      description: "Run the original astrology engine for this accepted private question and selected lens. Call first before answering a chart question. Takes no arguments: the server has already bound the chart, question and method. Returns traceable evidence and limitations, not scientific predictions or current transits.",
      input: { type: "object", additionalProperties: false, properties: {}, required: [] },
      // V2 defaults custom tools to CodeMode. Keep this direct: the general
      // `execute` capability is deliberately denied in the product harness.
      options: { permission: "chart_evidence", codemode: false },
      async execute(input, context) {
        try {
          const output = await sessions.execute(String(context.sessionID), String(context.agent), input);
          return { content: JSON.stringify(output ?? null) };
        } catch {
          return { content: JSON.stringify({ error: "Original-engine evidence could not complete. Do not invent evidence or a grounded answer." }) };
        }
      },
    });
  });
  await ctx.session.hook("context", (context) => {
    const allowed = new Set(sessions.allowed(String(context.sessionID), String(context.agent)));
    for (const name of Object.keys(context.tools)) if (!allowed.has(name)) delete context.tools[name];
  });
}
