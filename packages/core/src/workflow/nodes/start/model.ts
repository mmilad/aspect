import type { BagShape, WorkflowNode } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeStart } from "./execute";
import { parseStartConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };

function writesOf(node: WorkflowNode): string[] {
  return node.data.writes ?? node.data.outputs ?? [];
}

export const startNode: WorkflowNodeModel = {
  type: "start",
  kind: "control",
  defaultData: () => ({ title: "Start", writes: ["goal"] }),
  parseConfig: parseStartConfig,
  execute: executeStart,
  inferOutputs: (node) => {
    const out: Record<string, BagShape> = {};
    for (const key of writesOf(node)) {
      if (key === "goal") {
        out.goal = STRING;
      }
    }
    return out;
  }
};
