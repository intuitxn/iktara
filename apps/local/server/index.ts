import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  appRoot,
  chat,
  closeRuntime,
  configured,
  initializeRuntime,
  runtimeStatus,
} from "./runtime.js";
import {
  WorkspaceError,
  WorkspaceStore,
  SESSION_AGE_SECONDS,
  type Profile,
  type ChartResult,
} from "./workspace.js";
import { JobWorker } from "./jobs.js";
import { isWorld, publicWorlds } from "./worlds.js";
import { DOMAINS, METHODS, prepareEvidence, type Domain, type Method } from "./evidence.js";
import { agentToolSessions } from "./agent-tools.js";

const port = Number(process.env.PORT || 3210);
const computeUrl = new URL(process.env.COMPUTE_URL || "http://127.0.0.1:8001");
if (!["localhost", "127.0.0.1", "[::1]"].includes(computeUrl.hostname))
  throw new Error("COMPUTE_URL must point to the local chart server");
const publicOrigin = process.env.IKTARA_PUBLIC_ORIGIN
  ? new URL(process.env.IKTARA_PUBLIC_ORIGIN)
  : undefined;
const allowedHosts = new Set([
  `127.0.0.1:${port}`,
  `localhost:${port}`,
  `[::1]:${port}`,
  ...(publicOrigin ? [publicOrigin.host] : []),
]);
const dist = path.join(appRoot, "dist");
const maxBody = 64 * 1024;
const buckets = new Map<string, { count: number; until: number }>();
const store = new WorkspaceStore(
  path.join(
    process.env.IKTARA_RUNTIME_DIR || path.join(appRoot, ".runtime"),
    "workspace.sqlite",
  ),
);
store.recoverInterrupted();
const worker = new JobWorker(store, (input, owner, jobId) =>
  chat(input, { workspaceKey: owner, ...(input.page === "chart" ? { evidence: async () => {
    if (store.getJob(owner, jobId)?.status !== "running") throw new Error("Reading ended");
    await prepareEvidence(input, computeUrl, process.env.COMPUTE_API_KEY || "");
    if (store.getJob(owner, jobId)?.status !== "running") throw new Error("Reading ended");
    return input.evidence;
  } } : {}) }),
);
const cookieName = "iktara_session";
class HttpError extends WorkspaceError {}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}
function identity(
  request: IncomingMessage,
  response: ServerResponse,
  create = false,
): string {
  const cookies =
    request.headers.cookie?.split(";").map((part) => part.trim()) || [];
  const token = cookies
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  const owner = store.resolveIdentity(token);
  if (owner) return owner;
  if (!create)
    throw new HttpError(401, "Open your workspace again to continue.");
  const fresh = store.createIdentity();
  const secure =
    publicOrigin?.protocol === "https:" &&
    request.headers.host === publicOrigin.host;
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=${fresh.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE_SECONDS}${secure ? "; Secure" : ""}`,
  );
  return fresh.owner;
}
async function body(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "Send JSON to this endpoint.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBody) throw new HttpError(413, "This request is too large.");
    chunks.push(chunk);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Send a valid JSON object.");
  }
}
function only(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new HttpError(400, "This request contains unsupported fields.");
}
function profileValue(value: unknown): Profile {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Provide valid birth details.");
  const data = value as Record<string, unknown>;
  only(data, [
    "name",
    "date_of_birth",
    "time_of_birth",
    "birthplace",
    "birth_time_quality",
  ]);
  const {
    name = "",
    date_of_birth = "",
    time_of_birth = null,
    birthplace = "",
    birth_time_quality = "unknown",
  } = data;
  if (
    typeof name !== "string" ||
    name.length > 80 ||
    typeof date_of_birth !== "string" ||
    (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) ||
    typeof birthplace !== "string" ||
    birthplace.length > 200 ||
    (time_of_birth !== null &&
      (typeof time_of_birth !== "string" ||
        (time_of_birth &&
          !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time_of_birth)))) ||
    !["exact", "approximate", "unknown"].includes(String(birth_time_quality))
  )
    throw new HttpError(400, "Check your birth details and try again.");
  return {
    name: name.trim(),
    date_of_birth,
    time_of_birth:
      birth_time_quality === "unknown" ? null : time_of_birth || null,
    birthplace: birthplace.trim(),
    birth_time_quality: birth_time_quality as Profile["birth_time_quality"],
  };
}
function limit(key: string, maximum = 15) {
  const now = Date.now();
  if (buckets.size > 1000)
    for (const [entry, bucket] of buckets)
      if (bucket.until <= now) buckets.delete(entry);
  const bucket = buckets.get(key);
  if (!bucket || bucket.until <= now)
    buckets.set(key, { count: 1, until: now + 60_000 });
  else if (++bucket.count > maximum)
    throw new HttpError(429, "Please pause a moment before trying again.");
}
async function chartReady() {
  try {
    return (
      await fetch(new URL("/health", computeUrl), {
        signal: AbortSignal.timeout(2000),
      })
    ).ok;
  } catch {
    return false;
  }
}
const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  );
  try {
    if (!allowedHosts.has(request.headers.host || ""))
      throw new HttpError(403, "Unknown app host.");
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    if (pathname === "/api/health" && request.method === "GET")
      return json(response, 200, {
        ok: true,
        opencode: runtimeStatus(),
        chart: { ready: await chartReady() },
      });
    if (pathname === "/api/workspace" && request.method === "GET") {
      limit(`open:${request.socket.remoteAddress}`, 120);
      const owner = identity(request, response, true);
      return json(response, 200, {
        ...store.workspace(owner),
        worlds: publicWorlds(),
      });
    }
    if (pathname.startsWith("/api/jobs/") && request.method === "GET") {
      const job = store.getJob(
        identity(request, response),
        pathname.slice("/api/jobs/".length),
      );
      if (!job) throw new HttpError(404, "Response not found.");
      return json(response, 200, job);
    }
    if (
      ["POST", "PUT", "DELETE"].includes(request.method || "") &&
      pathname.startsWith("/api/")
    ) {
      const expectedOrigin =
        publicOrigin && publicOrigin.host === request.headers.host
          ? publicOrigin.origin
          : `http://${request.headers.host}`;
      if (
        (request.headers.origin && request.headers.origin !== expectedOrigin) ||
        request.headers["sec-fetch-site"] === "cross-site"
      )
        throw new HttpError(403, "Requests must come from this app.");
      const owner = identity(request, response);
      limit(`write:${owner}`);
      if (pathname === "/api/workspace" && request.method === "DELETE") {
        agentToolSessions.clearOwner(owner);
        store.reset(owner);
        return json(response, 200, { ok: true });
      }
      const value = await body(request);
      if (pathname === "/api/profile" && request.method === "PUT") {
        only(value, ["profile"]);
        store.saveProfile(
          owner,
          value.profile === null ? null : profileValue(value.profile),
        );
        return json(response, 200, store.workspace(owner));
      }
      if (pathname === "/api/chat" && request.method === "POST") {
        only(value, ["message", "page", "requestId", "method", "domain"]);
        const method = value.method ?? "compare";
        const domain = value.domain ?? "general";
        if (!METHODS.includes(method as Method) || !DOMAINS.includes(domain as Domain))
          throw new HttpError(400, "Choose a supported reading lens and topic.");
        if (
          typeof value.message !== "string" ||
          !value.message.trim() ||
          value.message.length > 4000
        )
          throw new HttpError(
            400,
            "Your message must contain 1–4,000 characters.",
          );
        const page = value.page ?? "reflection";
        if (!isWorld(page))
          throw new HttpError(400, "Choose a supported space.");
        if (
          value.requestId !== undefined &&
          (typeof value.requestId !== "string" ||
            !/^[0-9a-f-]{36}$/i.test(value.requestId))
        )
          throw new HttpError(400, "Invalid request identifier.");
        if (!configured)
          throw new HttpError(
            503,
            "Add the OpenCode API key and model in local server settings to start chatting.",
          );
        const job = store.enqueue(
          owner,
          page,
          value.message.trim(),
          typeof value.requestId === "string" ? value.requestId : randomUUID(),
          method as Method,
          domain as Domain,
        );
        worker.wake();
        return json(response, 202, { jobId: job.id });
      }
      if (pathname === "/api/chart" && request.method === "POST") {
        // The UI contract sends { profile }; the earlier client sent the
        // profile fields directly. Accept both shapes without widening fields.
        let payload = value;
        if ("profile" in value) {
          only(value, ["profile"]);
          payload = value.profile as Record<string, unknown>;
        }
        const profile = profileValue(payload);
        if (!profile.date_of_birth || !profile.birthplace)
          throw new HttpError(400, "Provide a birth date and birthplace.");
        if (profile.birth_time_quality !== "unknown" && !profile.time_of_birth)
          throw new HttpError(400, "Enter a birth time or choose 'I do not know my birth time'.");
        const upstream = await fetch(new URL("/v1/chart/compute", computeUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.COMPUTE_API_KEY || "",
          },
          body: JSON.stringify(profile),
          signal: AbortSignal.timeout(30_000),
        });
        if (!upstream.ok)
          throw new HttpError(
            upstream.status < 500 ? 400 : 502,
            "The chart could not be calculated. Check the birth details and try again.",
          );
        const result = (await upstream.json()) as ChartResult;
        if (!result.chart || typeof result.chart !== "object")
          throw new HttpError(
            502,
            "The chart service returned an invalid result.",
          );
        store.saveProfile(owner, profile, result);
        // Profile plus the calculated chart so the UI can render immediately.
        return json(response, 200, { ...result, profile });
      }
    }
    if (pathname.startsWith("/api/"))
      return json(response, 404, { error: "Endpoint not found." });
    if (request.method !== "GET" && request.method !== "HEAD")
      throw new HttpError(405, "Method not allowed.");
    const decoded = decodeURIComponent(pathname);
    let filename = path.resolve(dist, `.${decoded}`);
    if (filename !== dist && !filename.startsWith(`${dist}${path.sep}`))
      throw new HttpError(404, "Not found.");
    if (!(await stat(filename).catch(() => null))?.isFile())
      filename = path.join(dist, "index.html");
    const contents = await readFile(filename).catch(() => null);
    if (!contents)
      throw new HttpError(
        503,
        "Build the Iktara frontend first with npm run build.",
      );
    response.writeHead(200, {
      "Content-Type":
        mime[path.extname(filename)] || "application/octet-stream",
      "Cache-Control": filename.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=3600",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch (error) {
    json(response, error instanceof WorkspaceError ? error.status : 502, {
      error:
        error instanceof WorkspaceError
          ? error.message
          : "The local service is unavailable. Please try again shortly.",
    });
  }
});
server.requestTimeout = 120_000;
server.headersTimeout = 15_000;
server.listen(port, "127.0.0.1", () =>
  console.log(`Iktara listening at http://127.0.0.1:${port}`),
);
initializeRuntime()
  .then(() => {
    if (configured) worker.wake();
  })
  .catch((error) =>
    console.error(
      `OpenCode v2 runtime failed to initialize (${error instanceof Error ? error.name : "unknown error"}).`,
    ),
  );
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close();
    // Let an in-flight turn finish; an external forced stop is recovered as an error.
    void worker
      .stop()
      .then(closeRuntime)
      .finally(() => {
        store.close();
        process.exit(0);
      });
  });
