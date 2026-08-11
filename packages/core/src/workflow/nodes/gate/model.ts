import type { WorkflowNodeModel } from "../_shared/model";
import { executeGate } from "./execute";
import { gateInspectorFields } from "./inspector";
import { parseGateNodeConfig } from "./schema";

export const gateNode: WorkflowNodeModel = {
  type: "gate",
  kind: "control",
  configKey: "gate",
  defaultData: () => ({ title: "Gate", reads: [], gate: {} }),
  parseConfig: parseGateNodeConfig,
  execute: executeGate,
  inspectorFields: gateInspectorFields
};
