import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { derivedWrites } from "../../ports";
import { executeStart } from "./execute";
import { parseStartConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };

export const startNode: WorkflowNodeModel = {
  type: "start",
  kind: "control",
  defaultData: () => ({ title: "Start", writes: ["goal"] }),
  parseConfig: parseStartConfig,
  execute: executeStart,
  inferOutputs: (node) => {
    const out: Record<string, BagShape> = {};
    for (const key of derivedWrites(node)) {
      if (key === "goal") {
        out.goal = STRING;
      }
    }
    return out;
  }
};
