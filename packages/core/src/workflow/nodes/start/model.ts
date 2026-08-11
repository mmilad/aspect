import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { derivedWrites, resolveWriteBindings } from "../../ports";
import { executeStart } from "./execute";
import { startInspectorFields } from "./inspector";
import { parseStartConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };

export const startNode: WorkflowNodeModel = {
  type: "start",
  kind: "control",
  defaultData: () => ({
    title: "Start",
    writes: ["goal"],
    writeBindings: { goal: "goal" },
    outputContracts: {
      goal: { required: false, shape: STRING }
    }
  }),
  parseConfig: parseStartConfig,
  execute: executeStart,
  inferOutputs: (node) => {
    const out: Record<string, BagShape> = {};
    const writeBindings = resolveWriteBindings(node);
    for (const key of derivedWrites(node)) {
      const portId =
        Object.entries(writeBindings).find(([, bagKey]) => bagKey === key)?.[0] ?? key;
      const contractShape = node.data.outputContracts?.[portId]?.shape;
      if (contractShape) {
        out[key] = contractShape;
      } else if (key === "goal") {
        out.goal = STRING;
      }
    }
    return out;
  },
  inspectorFields: startInspectorFields,
  validateTopology: ({ node, incoming, errors }) => {
    if (incoming.length > 0) {
      errors.push(`Start node ${node.id} must not have incoming edges.`);
    }
  }
};
