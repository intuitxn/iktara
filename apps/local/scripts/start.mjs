import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = process.env.IKTARA_ENV_FILE || resolve(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const compute = resolve(root, "../../shastra-compute");
const web = resolve(root, "../web");
const python = resolve(compute, ".venv/bin/python");
if (
  !existsSync(python) ||
  !existsSync(resolve(root, "dist/index.html")) ||
  !existsSync(resolve(web, ".next/BUILD_ID"))
) {
  console.error(
    "Run uv sync --python 3.12 in shastra-compute, npm install && npm run build in apps/local, and corepack pnpm install && corepack pnpm build in apps/web.",
  );
  process.exit(1);
}
// Keep credentials in this process environment; never write generated keys to disk.
const key = process.env.COMPUTE_API_KEY || randomBytes(32).toString("hex");
const port = String(process.env.PORT || "3210");
const webPort = String(process.env.WEB_PORT || "3211");
const computePort = String(process.env.COMPUTE_PORT || "8001");
const unprivileged = (value) =>
  /^\d+$/.test(value) && Number(value) >= 1024 && Number(value) <= 65535;
for (const [name, value] of [
  ["PORT", port],
  ["WEB_PORT", webPort],
  ["COMPUTE_PORT", computePort],
]) {
  if (!unprivileged(value))
    throw new Error(`${name} must be an unprivileged TCP port.`);
}
if (new Set([port, webPort, computePort]).size !== 3)
  throw new Error("PORT, WEB_PORT, and COMPUTE_PORT must be distinct.");
const env = {
  ...process.env,
  COMPUTE_API_KEY: key,
  COMPUTE_URL: `http://127.0.0.1:${computePort}`,
};
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 1500).unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
function launch(command, args, cwd, childEnv) {
  const child = spawn(command, args, { cwd, env: childEnv, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
  return child;
}
launch(
  python,
  [
    "-m",
    "uvicorn",
    "src.local_app:app",
    "--host",
    "127.0.0.1",
    "--port",
    computePort,
  ],
  compute,
  { ...env, API_KEY: key },
);
let healthy = false;
for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
  try {
    const response = await fetch(`${env.COMPUTE_URL}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      healthy = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!healthy) {
  console.error("Chart service did not become ready.");
  stop(1);
}
async function waitFor(url, label, attempts = 120) {
  for (let attempt = 0; attempt < attempts && !stopping; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        console.log(`${label} ready (${url})`);
        return true;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}
launch(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    webPort,
    "--hostname",
    "127.0.0.1",
  ],
  web,
  { ...env, NODE_ENV: "production" },
);
if (!(await waitFor(`http://127.0.0.1:${webPort}/`, "Web"))) {
  console.error("Web server did not become ready.");
  stop(1);
}
launch(
  resolve(root, "node_modules/bun/bin/bun.exe"),
  ["server/index.ts"],
  root,
  {
    ...env,
    PORT: port,
    // The runtime is the public entry: it serves /api/* and proxies pages to
    // the Next app on WEB_PORT. An operator-provided IKTARA_PUBLIC_ORIGIN
    // (e.g. https://forsee.life) still wins.
    WEB_URL: `http://127.0.0.1:${webPort}`,
    IKTARA_PUBLIC_ORIGIN:
      process.env.IKTARA_PUBLIC_ORIGIN || `http://127.0.0.1:${port}`,
  },
);
if (!(await waitFor(`http://127.0.0.1:${port}/api/health`, "Runtime"))) {
  console.error("Runtime did not become ready.");
  stop(1);
} else {
  console.log(
    `Iktara ready on http://127.0.0.1:${port} (web ${webPort}, compute ${computePort})`,
  );
}
