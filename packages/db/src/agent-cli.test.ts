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

  it("orients to matching task titles and suggests nearby entities", () => {
    const dbPath = createTempDbPath();

    const taskOutput = runCli(dbPath, [
      "add-task",
      "--title",
      "Tune workflow packet discovery",
      "--target",
      "feature:feature_agent_orientation",
      "--description",
      "Make agent handoff work searchable.",
      "--link",
      "implements"
    ]);
    const taskId = taskOutput.match(/\((task_[^)]+)\)/)?.[1];

    const directOrient = runCli(dbPath, ["orient", "workflow packet"]);
    expect(directOrient).toContain(`- task ${taskId}:`);
    expect(directOrient).toContain("Tune workflow packet discovery");

    const nearbyOrient = runCli(dbPath, ["orient", "next navigation"]);
    expect(nearbyOrient).toContain("Graph Navigation");
    expect(nearbyOrient).toContain("score ");
  });

  it("scores multi-token matches across entity fields", () => {
    const dbPath = createTempDbPath();
    const metadataPath = path.join(path.dirname(dbPath), "metadata.json");
    writeFileSync(metadataPath, JSON.stringify({ behavior: "Search ranks matching entities with an inspectable score." }), "utf8");

    const featureId = createdId(
      runCli(dbPath, [
        "create-entity",
        "--type",
        "feature",
        "--title",
        "Full Entity Graph Navigation",
        "--summary",
        "Show all entity types in the graph with filters, search scoring, and detail entry.",
        "--target",
        "node_graph_view",
        "--link",
        "implements",
        "--metadata-file",
        metadataPath
      ]),
      "feature"
    );

    const orient = runCli(dbPath, ["orient", "type filters scored search"]);
    expect(orient).toContain(`- feature ${featureId}:`);
    expect(orient).toContain("score ");
    expect(orient).toContain("Full Entity Graph Navigation");
  });

  it("writes and reads orientation packets as linked references", () => {
    const dbPath = createTempDbPath();
    const metadataPath = path.join(path.dirname(dbPath), "packet.json");
    writeFileSync(
      metadataPath,
      JSON.stringify({
        workflow: "task.consumption.handoff",
        state: "ready_for_execution",
        anchors: ["packages/db/src/agent-cli.ts"],
        facts: ["The CLI owns agent-facing commands."],
        next: "Read the packet before broad code search.",
        avoid: ["Do not reread seed data unless changing bootstrap fixtures."],
        confidence: "high"
      }),
      "utf8"
    );

    const output = runCli(dbPath, [
      "packet-write",
      "--entity",
      "task_agent_plan_cli",
      "--title",
      "Packet for agent CLI",
      "--metadata-file",
      metadataPath
    ]);
    const packetId = output.match(/Wrote packet (reference_[^.]+)\./)?.[1];
    expect(packetId).toBeTruthy();

    const packets = JSON.parse(runCli(dbPath, ["packet-read", "--entity", "task_agent_plan_cli"])) as Array<{
      id: string;
      metadata: { kind?: string; targetIds?: string[] };
    }>;
    expect(packets.some((packet) => packet.id === packetId)).toBe(true);
    expect(packets.find((packet) => packet.id === packetId)?.metadata.kind).toBe("orientation_packet");
    expect(packets.find((packet) => packet.id === packetId)?.metadata.targetIds).toContain("task_agent_plan_cli");
  });
});
