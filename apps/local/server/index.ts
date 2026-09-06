import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  appRoot,
  chat,
  closeRuntime,
  configured,
  initializeRuntime,
  runtimeStatus,
} from "./runtime.js";
import type { ChatInput } from "./prompts.js";

const port = Number(process.env.PORT || 3210);
const computeUrl = new URL(process.env.COMPUTE_URL || "http://127.0.0.1:8001");
if (!["localhost", "127.0.0.1", "[::1]"].includes(computeUrl.hostname))
  throw new Error("COMPUTE_URL must point to the local chart server");
const dist = path.join(appRoot, "dist");
const maxBody = 64 * 1024;
const buckets = new Map<string, { count: number; until: number }>();
let activeChats = 0;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
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

function validateChat(value: Record<string, unknown>): ChatInput {
  if (
    typeof value.message !== "string" ||
    !value.message.trim() ||
    value.message.length > 4000
  )
    throw new HttpError(400, "Your message must contain 1–4,000 characters.");
  for (const key of ["profile", "chart"]) {
    if (
      value[key] != null &&
      (typeof value[key] !== "object" || Array.isArray(value[key]))
    )
      throw new HttpError(400, `${key} must be an object.`);
  }
  if (
    value.history != null &&
    (!Array.isArray(value.history) ||
      value.history.length > 20 ||
      value.history.some(
        (entry) =>
          !entry ||
          typeof entry !== "object" ||
          !["user", "assistant"].includes(entry.role) ||
          typeof entry.content !== "string" ||
          entry.content.length > 8000,
      ))
  )
    throw new HttpError(400, "Conversation history is invalid or too long.");
  return {
    message: value.message.trim(),
    profile: value.profile as ChatInput["profile"],
    chart: value.chart as ChatInput["chart"],
    history: value.history as ChatInput["history"],
  };
}

function limit(request: IncomingMessage) {
  // Never trust forwarded headers unless a specific trusted proxy is configured.
  const key = request.socket.remoteAddress || "local";
  const now = Date.now();
  if (buckets.size > 1000)
    for (const [entry, bucket] of buckets)
      if (bucket.until <= now) buckets.delete(entry);
  const bucket = buckets.get(key);
  if (!bucket || bucket.until <= now)
    buckets.set(key, { count: 1, until: now + 60_000 });
  else if (++bucket.count > 15)
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
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    if (pathname === "/api/health" && request.method === "GET") {
      return json(response, 200, {
        ok: true,
        opencode: runtimeStatus(),
        chart: { ready: await chartReady() },
      });
    }
    if (request.method === "POST" && pathname.startsWith("/api/")) {
      const origin = request.headers.origin;
      if (origin && new URL(origin).host !== request.headers.host)
        throw new HttpError(403, "Requests must come from this app.");
      limit(request);
      const value = await body(request);
      if (pathname === "/api/chat") {
        const input = validateChat(value);
        if (!configured)
          throw new HttpError(
            503,
            "Add the OpenCode API key and model in local server settings to start chatting.",
          );
        if (activeChats >= 2)
          throw new HttpError(429, "Iktara is busy. Please try again shortly.");
        activeChats++;
        try {
          return json(response, 200, { text: await chat(input) });
        } catch {
          throw new HttpError(
            502,
            "Iktara could not get a reply from OpenCode. Please check the local key and model settings and try again.",
          );
        } finally {
          activeChats--;
        }
      }
      if (pathname === "/api/chart") {
        if (
          typeof value.date_of_birth !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value.date_of_birth) ||
          typeof value.birthplace !== "string" ||
          !value.birthplace.trim() ||
          value.birthplace.length > 200
        )
          throw new HttpError(400, "Provide a birth date and birthplace.");
        const upstream = await fetch(new URL("/v1/chart/compute", computeUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.COMPUTE_API_KEY || "",
          },
          body: JSON.stringify({
            date_of_birth: value.date_of_birth,
            time_of_birth: value.time_of_birth ?? null,
            birthplace: value.birthplace,
            birth_time_quality: value.birth_time_quality ?? "unknown",
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!upstream.ok)
          throw new HttpError(
            upstream.status < 500 ? 400 : 502,
            "The chart could not be calculated. Check the birth details and try again.",
          );
        return json(response, 200, await upstream.json());
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
    json(response, error instanceof HttpError ? error.status : 502, {
      error:
        error instanceof HttpError
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
initializeRuntime().catch((error) => {
  // Log no request bodies, provider headers, or credentials.
  console.error(
    `OpenCode v2 runtime failed to initialize (${error instanceof Error ? error.name : "unknown error"}).`,
  );
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close();
    void closeRuntime().finally(() => process.exit(0));
  });
