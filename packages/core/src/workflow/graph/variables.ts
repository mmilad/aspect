import { parseBagShape } from "../shapes";
import { isRecord } from "../nodes/_shared/schema";
import type { BagShape } from "../nodes/_shared/types";
import type { WorkflowGraph, WorkflowVariable, WorkflowVariableRole } from "./types";

const ROLE_SET = new Set<string>(["input", "output", "local"]);

export function usesPinFrame(graph: WorkflowGraph): boolean {
  return Array.isArray(graph.variables);
}

export function pinKey(nodeId: string, portId: string): string {
  return `${nodeId}::${portId}`;
}

export function variablesOfRole(graph: WorkflowGraph, role: WorkflowVariableRole): WorkflowVariable[] {
  return (graph.variables ?? []).filter((variable) => variable.role === role);
}

export function findVariable(graph: WorkflowGraph, name: string): WorkflowVariable | undefined {
  return graph.variables?.find((variable) => variable.name === name);
}

export function parseVariables(raw: unknown, errors: string[]): WorkflowVariable[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    errors.push("Workflow graph.variables must be an array.");
    return undefined;
  }
  const variables: WorkflowVariable[] = [];
  const names = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || typeof item.name !== "string" || !item.name.trim()) {
      errors.push("Each workflow variable requires a name.");
      continue;
    }
    const name = item.name.trim();
    if (names.has(name)) {
      errors.push(`Duplicate workflow variable '${name}'.`);
      continue;
    }
    names.add(name);
    if (typeof item.role !== "string" || !ROLE_SET.has(item.role)) {
      errors.push(`Variable '${name}' requires role input|output|local.`);
      continue;
    }
    let shape: BagShape = { kind: "unknown" };
    if (item.shape !== undefined) {
      const parsed = parseBagShape(item.shape);
      if (!parsed) {
        errors.push(`Variable '${name}' has invalid shape.`);
      } else {
        shape = parsed;
      }
    }
    variables.push({
      name,
      role: item.role as WorkflowVariableRole,
      shape,
      required: typeof item.required === "boolean" ? item.required : undefined
    });
  }
  return variables;
}

/** Copy graph variables onto Start outputContracts and End inputs. */
export function syncVariablePorts(graph: WorkflowGraph): void {
  if (!graph.variables) {
    return;
  }
  const inputs = variablesOfRole(graph, "input");
  const outputs = variablesOfRole(graph, "output");
  for (const node of graph.nodes) {
    if (node.type === "start") {
      node.data.outputContracts = Object.fromEntries(
        inputs.map((variable) => [
          variable.name,
          { required: variable.required, shape: variable.shape }
        ])
      );
    }
    if (node.type === "end") {
      node.data.inputs = Object.fromEntries(
        outputs.map((variable) => [
          variable.name,
          { required: variable.required, shape: variable.shape }
        ])
      );
    }
  }
}
