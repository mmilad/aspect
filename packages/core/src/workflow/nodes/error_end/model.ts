import type { WorkflowNodeModel } from "../_shared/model";
import { executeErrorEnd } from "./execute";
import { parseErrorEndConfig } from "./schema";

export const errorEndNode: WorkflowNodeModel = {
  type: "error_end",
  kind: "control",
  defaultData: () => ({ title: "Error End" }),
  parseConfig: parseErrorEndConfig,
  execute: executeErrorEnd
};
