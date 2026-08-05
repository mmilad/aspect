import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("projectplaner mcp smoke", () => {
  it("orients and writes packets through plan helpers", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "projectplaner-mcp-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "test.db");

    const output = execFileSync(process.execPath, ["--import", "tsx", "src/smoke.ts"], {
      cwd: path.resolve(moduleDir, ".."),
      encoding: "utf8",
      env: {
        ...process.env,
        PROJECTPLANER_DB_PATH: dbPath
      }
    });

    expect(output).toContain("ok ");
    expect(output).toContain(dbPath);
  });
});
