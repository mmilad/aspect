import type { WorkflowVariable, WorkflowVariableRole } from "@projectplaner/core";
import { nextUniqueName } from "../shared";

export function updateVariable(
  variables: WorkflowVariable[],
  index: number,
  patch: Partial<WorkflowVariable>
): WorkflowVariable[] {
  return variables.map((variable, itemIndex) => (itemIndex === index ? { ...variable, ...patch } : variable));
}

export function removeVariable(variables: WorkflowVariable[], index: number): WorkflowVariable[] {
  return variables.filter((_, itemIndex) => itemIndex !== index);
}

export function addVariable(variables: WorkflowVariable[], role: WorkflowVariableRole): WorkflowVariable[] {
  const base = role === "local" ? "local" : role;
  const name = nextUniqueName(variables.map((variable) => variable.name), base);
  return [
    ...variables,
    {
      name,
      role,
      shape: { kind: "any" },
      required: role === "input"
    }
  ];
}
