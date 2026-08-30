export { orientBriefing } from "./orient";
export { getEntity, listEntities, nextWork, searchEntities } from "./reads";
export { createEntity, createRelation, updateEntity } from "./writes";
export { packetRead, packetWrite } from "./packets";
export { runWorkflow } from "./workflows";

export function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data) }]
  };
}

export function errorResult(error: unknown) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }]
  };
}
