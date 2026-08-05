import path from "node:path";
import { createPlanEntity, getPlanEntity, orient, packetRead, packetWrite } from "./plan";

async function main(): Promise<void> {
  const result = await orient("agent orientation");
  if (result.project.key !== "PLAN") {
    throw new Error("Expected PLAN project.");
  }
  if (result.matches.length === 0) {
    throw new Error("Expected orient matches.");
  }

  const created = await createPlanEntity({
    type: "task",
    title: "MCP smoke task",
    targetEntityId: "node_agent_orientation",
    linkType: "affects",
    priority: "low",
    acceptanceCriteria: ["Task exists via MCP helpers"]
  });
  const entity = await getPlanEntity(created.entity.id);
  if (entity.title !== "MCP smoke task") {
    throw new Error("Created task title mismatch.");
  }

  const packet = await packetWrite({
    entityId: created.entity.id,
    metadata: {
      workflow: "task.consumption.handoff",
      state: "ready_for_execution",
      next: "Stop after smoke verification",
      confidence: "high"
    }
  });
  const packets = await packetRead(created.entity.id);
  if (!packets.some((item) => item.id === packet.id)) {
    throw new Error("Packet was not readable after write.");
  }

  console.log(`ok ${created.entity.id} ${packet.id} db=${process.env.PROJECTPLANER_DB_PATH ?? path.resolve("projectplaner.db")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
