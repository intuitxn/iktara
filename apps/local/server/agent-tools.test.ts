import { test } from "node:test";
import assert from "node:assert/strict";
import { AgentToolSessions, registerAgentTools } from "./agent-tools.js";
import type { Plugin } from "@opencode-ai/plugin";

const ownerA = "11111111-1111-1111-1111-111111111111";
const ownerB = "22222222-2222-2222-2222-222222222222";

test("evidence sessions bind server-owned closures and deny forged scopes", async () => {
  const sessions = new AgentToolSessions();
  sessions.bind("session-a", { owner: ownerA, agent: "iktara-chart", evidence: async () => ({ private: "A" }) });
  sessions.bind("session-b", { owner: ownerB, agent: "iktara-chart", evidence: async () => ({ private: "B" }) });
  assert.deepEqual(await sessions.execute("session-a", "iktara-chart", {}), { private: "A" });
  assert.deepEqual(await sessions.execute("session-b", "iktara-chart", {}), { private: "B" });
  assert.deepEqual(sessions.allowed("session-a", "iktara"), []);
  assert.deepEqual(sessions.allowed("forged", "iktara-chart"), []);
  await assert.rejects(sessions.execute("forged", "iktara-chart", {}));
  await assert.rejects(sessions.execute("session-a", "iktara", {}));
  assert.throws(() => sessions.bind("session-a", { owner: ownerB, agent: "iktara-chart", evidence: async () => null }));
});

test("chart_evidence accepts no chart, owner, query, method or destination arguments", async () => {
  const sessions = new AgentToolSessions();
  let calls = 0;
  sessions.bind("session", { owner: ownerA, agent: "iktara-chart", evidence: async () => ++calls });
  for (const raw of [null, [], "", { owner: ownerB }, { sessionID: "other" }, { query: "changed" }, { method: "kp" }, { chart: {} }, { url: "https://example.com" }])
    await assert.rejects(sessions.execute("session", "iktara-chart", raw));
  assert.equal(calls, 0);
});

test("concurrent and repeated calls compute once, including failures", async () => {
  const sessions = new AgentToolSessions();
  let calls = 0;
  sessions.bind("ok", { owner: ownerA, agent: "iktara-chart", evidence: async () => ++calls });
  assert.deepEqual(await Promise.all([sessions.execute("ok", "iktara-chart", {}), sessions.execute("ok", "iktara-chart", {})]), [1, 1]);
  assert.equal(await sessions.execute("ok", "iktara-chart", {}), 1);
  sessions.bind("failed", { owner: ownerA, agent: "iktara-chart", evidence: async () => { calls++; throw new Error("private upstream details"); } });
  await assert.rejects(sessions.execute("failed", "iktara-chart", {}));
  await assert.rejects(sessions.execute("failed", "iktara-chart", {}));
  assert.equal(calls, 2);
});

test("closed and owner-revoked sessions cannot return pending private evidence", async () => {
  for (const revokeOwner of [false, true]) {
    const sessions = new AgentToolSessions();
    let resolve!: (value: unknown) => void;
    const waiting = new Promise((done) => { resolve = done; });
    const unbind = sessions.bind("pending", { owner: ownerA, agent: "iktara-chart", evidence: () => waiting });
    const result = sessions.execute("pending", "iktara-chart", {});
    await Promise.resolve();
    if (revokeOwner) sessions.clearOwner(ownerA); else unbind();
    resolve({ private: "never return" });
    await assert.rejects(result, /ended/);
    await assert.rejects(sessions.execute("pending", "iktara-chart", {}));
    assert.deepEqual(sessions.allowed("pending", "iktara-chart"), []);
    sessions.bind("pending", { owner: ownerB, agent: "iktara-chart", evidence: async () => "new binding" });
    unbind();
    assert.equal(await sessions.execute("pending", "iktara-chart", {}), "new binding");
  }
});

test("plugin context strips tools for reflection, unknown and closed sessions and sanitizes failures", async () => {
  const sessions = new AgentToolSessions();
  const unbind = sessions.bind("bound", { owner: ownerA, agent: "iktara-chart", evidence: async () => { throw new Error("private-path-and-provider-credential"); } });
  type Context = { sessionID: string; agent: string; tools: Record<string, unknown> };
  type Tool = { name: string; execute: (input: unknown, context: Context) => Promise<{ content: string }> };
  let registered!: Tool;
  let hook!: (context: Context) => void;
  const removed: string[] = [];
  const ctx = {
    tool: { transform: async (callback: (editor: unknown) => void) => callback({
      list: () => [{ id: "bash" }, { id: "task" }, { id: "read" }],
      remove: (id: string) => removed.push(id),
      add: (tool: Tool) => { registered = tool; },
    }) },
    session: { hook: async (_name: string, callback: typeof hook) => { hook = callback; } },
  } as unknown as Plugin.Context;
  await registerAgentTools(ctx, sessions);
  assert.deepEqual(removed, ["bash", "task", "read"]);
  assert.equal(registered.name, "chart_evidence");
  for (const [sessionID, agent, expected] of [["bound", "iktara-chart", ["chart_evidence"]], ["bound", "iktara", []], ["unknown", "iktara-chart", []]] as const) {
    const context: Context = { sessionID, agent, tools: { chart_evidence: {}, bash: {}, task: {}, read: {} } };
    hook(context);
    assert.deepEqual(Object.keys(context.tools), [...expected]);
  }
  const failed = await registered.execute({}, { sessionID: "bound", agent: "iktara-chart", tools: {} });
  assert.match(failed.content, /could not complete/);
  assert.doesNotMatch(failed.content, /private-path|credential/);
  unbind();
  const closed = { sessionID: "bound", agent: "iktara-chart", tools: { chart_evidence: {} } };
  hook(closed);
  assert.deepEqual(closed.tools, {});
});
