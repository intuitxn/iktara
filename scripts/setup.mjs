import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const [command, args, folder] of [
  ["uv", ["sync", "--frozen", "--python", "3.12"], "shastra-compute"],
  ["uv", ["run", "--frozen", "python", "-m", "unittest", "discover", "-s", "tests", "-p", "parity*.py", "-v"], "shastra-compute"],
  ["uv", ["run", "--frozen", "python", "-m", "unittest", "discover", "-s", "tests", "-p", "test*.py", "-v"], "shastra-compute"],
  ["npm", ["ci"], "apps/local"],
  ["npm", ["test"], "apps/local"],
  ["npm", ["run", "build"], "apps/local"],
]) {
  const result = spawnSync(command, args, {
    cwd: path.join(root, folder),
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    console.error(
      `Setup stopped at ${command}. Install Node.js 22.22+ and uv before setup.`,
    );
    process.exit(result.status || 1);
  }
}
console.log("Ready. Run npm run dev and open http://127.0.0.1:3220");
