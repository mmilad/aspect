import { spawnSync } from "node:child_process";

const execPath = process.env.npm_execpath;
const command = execPath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commandArgs = execPath
  ? [execPath]
  : [];
const args = [...commandArgs, "install", "--frozen-lockfile", "--offline", "--ignore-scripts", "--reporter", "append-only"];
const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env: { ...process.env, CI: "true" },
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(`Could not start pnpm: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
