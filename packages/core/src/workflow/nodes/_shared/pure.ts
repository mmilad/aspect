import type { WorkflowNodeType } from "./types";

/** Data-only nodes are pulled on data wires — never exec-walked. */
export function isPureDataNodeType(type: WorkflowNodeType): boolean {
  return type === "get" || type === "reroute" || type === "template" || type === "break";
}
