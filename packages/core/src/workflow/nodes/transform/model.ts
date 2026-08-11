import type { BagShape, WorkflowNode } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeTransform } from "./execute";
import { transformInspectorFields } from "./inspector";
import { parseTransformNodeConfig } from "./schema";

const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };

function writesOf(node: WorkflowNode): string[] {
  return node.data.writes ?? node.data.outputs ?? [];
}

export const transformNode: WorkflowNodeModel = {
  type: "transform",
  kind: "work",
  configKey: "auto",
  defaultData: () => ({ title: "Transform", reads: [], writes: [], auto: {} }),
  parseConfig: parseTransformNodeConfig,
  execute: executeTransform,
  inspectorFields: transformInspectorFields,
  inferOutputs: (node) => {
    const out: Record<string, BagShape> = {};
    const filter = node.data.auto?.filter;
    if (filter?.rank !== "task_candidates") {
      return out;
    }
    const writes = writesOf(node);
    const candidatesKey = writes[0] ?? "candidates";
    if (!node.data.outputContracts?.[candidatesKey]?.shape) {
      out[candidatesKey] = { kind: "array", items: { kind: "ref", ref: "RankedTaskCandidate" } };
    }
    if (writes.includes("hasCandidates")) {
      out.hasCandidates = BOOLEAN;
    }
    return out;
  }
};
