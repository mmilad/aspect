import { asStringMap, isRecord } from "../_shared/schema";
import type { WorkflowForeachConfig, WorkflowNodeData } from "../_shared/types";

export function parseForeachConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowForeachConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} foreach config must be an object.`);
    return undefined;
  }
  if (typeof raw.itemsFrom !== "string" || !raw.itemsFrom.trim()) {
    errors.push(`Node ${nodeId} foreach.itemsFrom is required.`);
    return undefined;
  }
  if (!isRecord(raw.body)) {
    errors.push(`Node ${nodeId} foreach.body is required.`);
    return undefined;
  }
  let body: WorkflowForeachConfig["body"] | null = null;
  if (raw.body.type === "subworkflow" && typeof raw.body.workflowId === "string") {
    body = {
      type: "subworkflow",
      workflowId: raw.body.workflowId,
      inputMap: asStringMap(raw.body.inputMap),
      outputMap: asStringMap(raw.body.outputMap)
    };
  } else if (
    raw.body.type === "subgraph" &&
    typeof raw.body.entryNodeId === "string" &&
    typeof raw.body.exitNodeId === "string"
  ) {
    body = {
      type: "subgraph",
      entryNodeId: raw.body.entryNodeId,
      exitNodeId: raw.body.exitNodeId
    };
  } else {
    errors.push(`Node ${nodeId} foreach.body must be subworkflow|{subgraph entry/exit}.`);
    return undefined;
  }

  const collect =
    isRecord(raw.collect) && typeof raw.collect.as === "string"
      ? {
          from:
            typeof raw.collect.from === "string"
              ? raw.collect.from
              : Array.isArray(raw.collect.from)
                ? (raw.collect.from.filter((item) => typeof item === "string") as string[])
                : "",
          as: raw.collect.as
        }
      : undefined;

  return {
    itemsFrom: raw.itemsFrom,
    itemKey: typeof raw.itemKey === "string" ? raw.itemKey : undefined,
    indexKey: typeof raw.indexKey === "string" ? raw.indexKey : undefined,
    body,
    concurrency: typeof raw.concurrency === "number" ? raw.concurrency : undefined,
    failureMode: raw.failureMode === "fail" || raw.failureMode === "continue" ? raw.failureMode : undefined,
    collect: collect && (typeof collect.from === "string" || collect.from.length > 0) ? collect : undefined
  };
}

export function parseForeachNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const foreach = parseForeachConfig(raw.foreach, nodeId, errors);
  return foreach ? { foreach } : {};
}
