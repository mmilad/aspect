import type { WorkflowNodeModel } from "../_shared/model";
import { executeWait } from "./execute";
import { waitInspectorFields } from "./inspector";
import { parseWaitNodeConfig } from "./schema";

export const waitNode: WorkflowNodeModel = {
  type: "wait",
  kind: "control",
  configKey: "wait",
  defaultData: () => ({ title: "Wait", wait: { delayMs: 0 } }),
  parseConfig: parseWaitNodeConfig,
  execute: executeWait,
  inspectorFields: waitInspectorFields,
  validateTopology: (ctx) => {
    if (ctx.node.data.wait?.delayMs === undefined && !ctx.node.data.wait?.until) {
      ctx.errors.push(`Wait ${ctx.node.id} requires wait.delayMs or wait.until.`);
    }
  }
};
