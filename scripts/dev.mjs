import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = path.join(root, "apps/local");
const child = spawn(process.execPath, ["scripts/start.mjs"], {
  cwd: app,
  env: {
    ...process.env,
    PORT: "3220",
    WEB_PORT: "3221",
    COMPUTE_PORT: "8020",
    IKTARA_RUNTIME_DIR: path.join(app, ".runtime-dev"),
  },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code || 0));
