import type { WorkflowNodeType } from "./types";

/** Get, reroute, and template are pulled on data wires — never exec-walked. */
export function isPureDataNodeType(type: WorkflowNodeType): boolean {
  return type === "get" || type === "reroute" || type === "template";
}
