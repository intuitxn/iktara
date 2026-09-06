import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conversationPrompt, type ChatInput } from "./prompts.js";
import type { OpenCode } from "@opencode-ai/sdk";
import { WORLDS } from "./worlds.js";
import { agentToolSessions } from "./agent-tools.js";

export const appRoot = fileURLToPath(new URL("../", import.meta.url));
const runtimeRoot = path.resolve(
  process.env.IKTARA_RUNTIME_DIR || path.join(appRoot, ".runtime"),
);
const directory = path.join(runtimeRoot, "workspace");
const model = process.env.OPENCODE_MODEL?.trim();
const apiKey = process.env.OPENCODE_API_KEY?.trim();
export const configured = Boolean(model && model.includes("/") && apiKey);
let host: OpenCode.Interface | undefined;
let starting: Promise<OpenCode.Interface> | undefined;
let failed = false;

export function runtimeStatus() {
  return {
    configured,
    ready: Boolean(host && configured),
    version: "v2-beta",
    model: model ?? null,
    ...(failed
      ? {
          reason:
            "The OpenCode runtime could not start. Check the local server log.",
        }
      : !configured
        ? {
            reason:
              "Add OPENCODE_API_KEY and OPENCODE_MODEL to local server settings.",
          }
        : {}),
  };
}

export async function initializeRuntime(): Promise<OpenCode.Interface> {
  if (host) return host;
  if (starting) return starting;
  starting = (async () => {
    await mkdir(runtimeRoot, { recursive: true, mode: 0o700 });
    await mkdir(directory, { recursive: true, mode: 0o700 });
    // These paths are set before importing the SDK: it never sees the personal
    // OpenCode configuration, credentials, plugins, or session database.
    for (const [name, folder] of Object.entries({
      XDG_CONFIG_HOME: "config",
      XDG_DATA_HOME: "data",
      XDG_CACHE_HOME: "cache",
      XDG_STATE_HOME: "state",
    }))
      process.env[name] = path.join(runtimeRoot, folder);
    process.env.OPENCODE_CONFIG_DIR = path.join(
      runtimeRoot,
      "config",
      "opencode",
    );
    // OpenCode also discovers ~/.claude and ~/.agents outside XDG config.
    // Its supported test-home override scopes those lookups without changing HOME.
    process.env.OPENCODE_TEST_HOME = path.join(runtimeRoot, "home");
    delete process.env.OPENCODE_CONFIG;
    delete process.env.OPENCODE_CONFIG_CONTENT;
    const [{ OpenCode }, { default: plugin }] = await Promise.all([
      import("@opencode-ai/sdk"),
      import("./plugin.js"),
    ]);
    const instance = await OpenCode.create({
      app: { name: "iktara", version: "0.1.0" },
      database: { path: path.join(runtimeRoot, "iktara.sqlite") },
      config: {
        directory: process.env.OPENCODE_CONFIG_DIR,
        project: false,
        content: JSON.stringify({
          share: "disabled",
          update: "disable",
          snapshots: false,
          formatter: false,
          lsp: false,
          permissions: [{ action: "*", resource: "*", effect: "deny" }],
          agents: Object.fromEntries(
            Object.values(WORLDS).map((world) => [
              world.agent,
              { mode: "primary", steps: world.id === "chart" ? 4 : 2,
                // The SDK can apply its config transform after our plugin.
                // Per-agent rules must follow the global deny in that path too.
                permissions: [{ action: "*", resource: "*", effect: "deny" },
                  ...(world.id === "chart" ? [{ action: "chart_evidence", resource: "*", effect: "allow" }] : [])],
              },
            ]),
          ),
          default_agent: "iktara",
          ...(model ? { model } : {}),
        }),
      },
      fs: { filewatcher: false, fff: false },
      plugins: [plugin],
    });
    try {
      // V2 activates location plugins lazily on the first session, not on list().
      const probe = await instance.sessions.create({
        location: { directory },
        agent: "iktara",
        title: "Runtime startup check",
      });
      try {
        await instance.plugin.awaitActivation({ location: { directory } });
        const agents = await instance.agent.list({ location: { directory } });
        if (
          agents.data.length !== Object.keys(WORLDS).length ||
          !Object.values(WORLDS).every((world) =>
            agents.data.some((agent) => agent.id === world.agent),
          )
        )
          throw new Error("Iktara plugin did not initialize");
        if (configured)
          await instance.integration.connect.key({
            location: { directory },
            integrationID:
              process.env.OPENCODE_INTEGRATION || model!.split("/")[0]!,
            key: apiKey!,
          });
      } finally {
        await instance.sessions.remove({ sessionID: probe.id });
      }
      host = instance;
      return instance;
    } catch (error) {
      await instance.close();
      throw error;
    }
  })().catch((error) => {
    failed = true;
    starting = undefined;
    throw error;
  });
  return starting;
}

export async function chat(
  input: ChatInput,
  options: { workspaceKey?: string; evidence?: () => Promise<unknown> } = {},
): Promise<string> {
  if (options.evidence && (!options.workspaceKey || input.page !== "chart"))
    throw new Error("Evidence requires an owned chart session");
  const instance = await initializeRuntime();
  if (options.workspaceKey && !/^[0-9a-f-]{36}$/.test(options.workspaceKey))
    throw new Error("Invalid internal workspace identity");
  const sessionDirectory = options.workspaceKey
    ? path.join(runtimeRoot, "people", options.workspaceKey)
    : directory;
  await mkdir(sessionDirectory, { recursive: true, mode: 0o700 });
  const world = WORLDS[input.page || "reflection"];
  const split = model!.indexOf("/");
  const request = { signal: AbortSignal.timeout(90_000) };
  const session = await instance.sessions.create(
    {
      location: { directory: sessionDirectory },
      agent: world.agent,
      title: `Iktara ${world.id}`,
      model: {
        providerID: model!.slice(0, split),
        id: model!.slice(split + 1),
      },
    },
    request,
  );
  let unbind: (() => void) | undefined;
  try {
    if (options.evidence)
      unbind = agentToolSessions.bind(session.id, { owner: options.workspaceKey!, agent: "iktara-chart", evidence: options.evidence });
    await instance.sessions.prompt(
      { sessionID: session.id, text: conversationPrompt(input) },
      request,
    );
    await instance.sessions.wait({ sessionID: session.id }, request);
    const messages = await instance.sessions.context(
      { sessionID: session.id },
      request,
    );
    const last = messages
      .filter((message) => message.type === "assistant")
      .at(-1);
    if (!last || last.error)
      throw new Error("OpenCode did not produce a complete reply");
    const text = last.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("OpenCode returned an empty reply");
    return text;
  } finally {
    unbind?.();
    await instance.sessions
      .interrupt({ sessionID: session.id })
      .catch(() => {});
    await instance.sessions.remove({ sessionID: session.id }).catch(() => {});
  }
}

export async function closeRuntime() {
  if (host) await host.close();
}
