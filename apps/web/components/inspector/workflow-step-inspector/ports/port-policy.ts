import type { WorkflowNodeType } from "@projectplaner/core";

export function canAuthorInputPorts(type: WorkflowNodeType): boolean {
  return type === "llm" || type === "template";
}

export function canAuthorOutputPorts(type: WorkflowNodeType): boolean {
  return type === "llm";
}
