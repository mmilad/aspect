import type { WorkflowNodeModel } from "../_shared/model";
import { executeEnd } from "./execute";
import { parseEndConfig } from "./schema";

export const endNode: WorkflowNodeModel = {
  type: "end",
  kind: "control",
  defaultData: () => ({ title: "End" }),
  parseConfig: parseEndConfig,
  execute: executeEnd
};
