import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const expectedPackageManager = manifest.devEngines?.packageManager;
const modulesFile = path.join(root, "node_modules", ".modules.yaml");
const requiredPaths = [
  path.join(root, "node_modules", ".bin", "tsc"),
  path.join(root, "node_modules", ".bin", "vitest"),
  path.join(root, "apps", "web", "node_modules", "next")
];

const missing = requiredPaths.filter((file) => !fs.existsSync(file));
const modulesText = fs.existsSync(modulesFile) ? fs.readFileSync(modulesFile, "utf8") : "";
const installedMatch = modulesText.match(/^packageManager:\s*(.+)$/m);
const installedPackageManager = installedMatch?.[1]?.trim();
const expected = expectedPackageManager?.name && expectedPackageManager?.version
  ? `${expectedPackageManager.name}@${expectedPackageManager.version}`
  : null;

if (missing.length === 0 && (!expected || !installedPackageManager || installedPackageManager === expected)) {
  console.log(`Dependencies are linked (${installedPackageManager ?? expected ?? "pnpm"}).`);
  process.exit(0);
}

console.error("Project dependencies are not in a healthy linked state.");
if (missing.length) {
  console.error(`Missing links: ${missing.map((file) => path.relative(root, file)).join(", ")}`);
}
if (expected && installedPackageManager && installedPackageManager !== expected) {
  console.error(`Installed layout uses ${installedPackageManager}; this project expects ${expected}.`);
}
console.error("Stop the Projectplaner MCP and dev server before repairing node_modules; Windows may lock their files.");
console.error("PowerShell: $env:CI='true'; pnpm install --frozen-lockfile --offline --ignore-scripts");
console.error("cmd.exe:     set CI=true && pnpm install --frozen-lockfile --offline --ignore-scripts");
process.exit(1);
