import path from "node:path";
import {
  createPlanEntity,
  getPlanEntity,
  nextWork,
  orientBriefing,
  packetRead,
  packetWrite,
  searchPlanEntities
} from "./plan";

async function main(): Promise<void> {
  const briefing = orientBriefing();
  if (briefing.project.key !== "PLAN") {
    throw new Error("Expected PLAN project.");
  }
  if (!briefing.next.includes("search")) {
    throw new Error("Expected orient briefing to point at search/next_work.");
  }

  const searched = await searchPlanEntities({ q: "agent orientation", limit: 5 });
  if (searched.items.length === 0) {
    throw new Error("Expected search matches.");
  }

  const created = await createPlanEntity({
    type: "task",
    title: "MCP smoke task",
    reason: "Smoke test create with enforced narrative reason.",
    proposal: "Delete after smoke if desired.",
    targetEntityId: "node_agent_orientation",
    linkType: "affects",
    priority: "low",
    acceptanceCriteria: ["Task exists via MCP helpers"]
  });
  if (!created.entity) {
    throw new Error("Missing created entity.");
  }
  const entity = await getPlanEntity(created.entity.id);
  if (entity.title !== "MCP smoke task") {
    throw new Error("Created task title mismatch.");
  }
  if (!("narrative" in entity) || (entity as { narrative?: { reason?: string } }).narrative?.reason == null) {
    throw new Error("Expected narrative.reason on created entity.");
  }

  const work = await nextWork({ relatedTo: "node_agent_orientation", limit: 5 });
  if (!work.meta || work.meta.mode !== "work") {
    throw new Error("Expected next_work meta.mode=work.");
  }

  const written = await packetWrite({
    entityId: created.entity.id,
    reason: "Smoke packet handoff with narrative stamp.",
    metadata: {
      workflow: "task.consumption.handoff",
      state: "ready_for_execution",
      next: "Stop after smoke verification",
      confidence: "high"
    }
  });
  const read = await packetRead(created.entity.id);
  if (!read.packets.some((item) => item.id === written.packet.id)) {
    throw new Error("Packet was not readable after write.");
  }
  if (!read.targetNarrative.reason) {
    throw new Error("Expected target narrative after packet_write.");
  }

  console.log(
    `ok ${created.entity.id} ${written.packet.id} db=${process.env.PROJECTPLANER_DB_PATH ?? path.resolve("projectplaner.db")}`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
