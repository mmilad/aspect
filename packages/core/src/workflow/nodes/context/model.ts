import type { BagShape, WorkflowNode } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeContext } from "./execute";
import { contextInspectorFields } from "./inspector";
import { parseContextNodeConfig } from "./schema";

function writesOf(node: WorkflowNode): string[] {
  return node.data.writes ?? node.data.outputs ?? [];
}

function arrayOfRef(ref: "Entity" | "EntityRelation"): BagShape {
  return { kind: "array", items: { kind: "ref", ref } };
}

export const contextNode: WorkflowNodeModel = {
  type: "context",
  kind: "work",
  configKey: "auto",
  defaultData: () => ({ title: "Context", reads: [], writes: [], auto: {} }),
  parseConfig: parseContextNodeConfig,
  execute: executeContext,
  inspectorFields: contextInspectorFields,
  inferOutputs: (node) => {
    const out: Record<string, BagShape> = {};
    const load = node.data.auto?.loadContext;
    if (!load) {
      return out;
    }
    const writes = writesOf(node);
    const entityKey = writes[0] ?? "matches";
    if (!node.data.outputContracts?.[entityKey]?.shape) {
      out[entityKey] = arrayOfRef("Entity");
    }
    if (load.includeRelations) {
      const relationKey =
        writes.find((key) => key === "relations") ?? (writes.length > 1 ? writes[1] : undefined);
      if (relationKey && !node.data.outputContracts?.[relationKey]?.shape) {
        out[relationKey] = arrayOfRef("EntityRelation");
      }
    }
    return out;
  }
};
