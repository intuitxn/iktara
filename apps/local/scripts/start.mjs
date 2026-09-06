import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = process.env.IKTARA_ENV_FILE || resolve(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const compute = resolve(root, "../../shastra-compute");
const python = resolve(compute, ".venv/bin/python");
if (!existsSync(python) || !existsSync(resolve(root, "dist/index.html"))) {
  console.error(
    "Run uv sync --python 3.12 in shastra-compute, then npm install && npm run build in apps/local.",
  );
  process.exit(1);
}
// Keep credentials in this process environment; never write generated keys to disk.
const key = process.env.COMPUTE_API_KEY || randomBytes(32).toString("hex");
const computePort = process.env.COMPUTE_PORT || "8001";
if (
  !/^\d+$/.test(computePort) ||
  Number(computePort) < 1024 ||
  Number(computePort) > 65535
) {
  throw new Error("COMPUTE_PORT must be an unprivileged TCP port.");
}
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
} else
  launch(
    resolve(root, "node_modules/bun/bin/bun.exe"),
    ["server/index.ts"],
    root,
    env,
  );
