import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function createTempDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "projectplaner-cli-"));
  tempDirs.push(dir);
  return path.join(dir, "projectplaner.db");
}

function runCli(dbPath: string, args: string[]): string {
  return execFileSync(process.execPath, ["--import", "tsx", "src/agent-cli.ts", ...args], {
    cwd: path.resolve(moduleDir, ".."),
    encoding: "utf8",
    env: { ...process.env, PROJECTPLANER_DB_PATH: dbPath }
  });
}

function createdId(output: string, type: string): string {
  const match = output.match(new RegExp(`Created ${type} (${type}_[^\\s.]+)`));
  if (!match) {
    throw new Error(`Could not read created ${type} id from: ${output}`);
  }
  return match[1];
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("agent CLI", () => {
  it("creates aspect containment from parent to child", () => {
    const dbPath = createTempDbPath();

    const aspectId = createdId(
      runCli(dbPath, [
        "create-entity",
        "--type",
        "aspect",
        "--title",
        "Should test CLI parenting",
        "--target",
        "node_agent_orientation",
        "--link",
        "contains"
      ]),
      "aspect"
    );

    const relations = runCli(dbPath, [
      "list-relations",
      "--from",
      "node_agent_orientation",
      "--to",
      aspectId,
      "--type",
      "contains"
    ]);

    expect(relations).toContain(`node_agent_orientation -[contains]-> ${aspectId}`);
  });

  it("adds tasks to generic-only aspect targets", () => {
    const dbPath = createTempDbPath();
    const aspectId = createdId(runCli(dbPath, ["create-entity", "--type", "aspect", "--title", "Should host generic tasks"]), "aspect");

    const taskOutput = runCli(dbPath, [
      "add-task",
      "--title",
      "Verify generic add task target",
      "--target",
      `aspect:${aspectId}`,
      "--link",
      "investigates"
    ]);
    const taskId = taskOutput.match(/\((task_[^)]+)\)/)?.[1];

    expect(taskId).toBeTruthy();
    expect(runCli(dbPath, ["list-relations", "--from", taskId ?? "", "--to", aspectId])).toContain(
      `${taskId} -[investigates]-> ${aspectId}`
    );
  });

  it("reads metadata from a JSON file and labels orient matches by entity type", () => {
    const dbPath = createTempDbPath();
    const metadataPath = path.join(path.dirname(dbPath), "metadata.json");
    writeFileSync(metadataPath, JSON.stringify({ codeAnchors: ["packages/db/src/agent-cli.ts"] }), "utf8");

    const questionId = createdId(
      runCli(dbPath, [
        "create-entity",
        "--type",
        "question",
        "--title",
        "How should CLI code orientation metadata work?",
        "--metadata-file",
        metadataPath
      ]),
      "question"
    );

    const entity = JSON.parse(runCli(dbPath, ["get-entity", "--id", questionId])) as { metadata: { codeAnchors?: string[] } };
    const orient = runCli(dbPath, ["orient", "CLI code orientation"]);

    expect(entity.metadata.codeAnchors).toEqual(["packages/db/src/agent-cli.ts"]);
    expect(orient).toContain(`- question ${questionId}: How should CLI code orientation metadata work?`);
  });
});
