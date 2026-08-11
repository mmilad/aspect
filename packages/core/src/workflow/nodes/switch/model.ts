import type { WorkflowNodeModel } from "../_shared/model";
import { executeSwitch } from "./execute";
import { switchInspectorFields } from "./inspector";
import { parseSwitchNodeConfig } from "./schema";

export const switchNode: WorkflowNodeModel = {
  type: "switch",
  kind: "control",
  configKey: "switch",
  defaultData: () => ({ title: "Switch", reads: [], switch: { defaultLabel: "default" } }),
  parseConfig: parseSwitchNodeConfig,
  execute: executeSwitch,
  inspectorFields: switchInspectorFields,
  validateTopology: (ctx) => {
    const routes = ctx.outgoing.filter((edge) => edge.kind === "route");
    if (routes.length < 2) {
      ctx.errors.push(`Switch ${ctx.node.id} requires at least two route edges.`);
    }
    const labels = routes.map((edge) => edge.label ?? "");
    if (new Set(labels).size !== labels.length) {
      ctx.errors.push(`Switch ${ctx.node.id} route labels must be unique.`);
    }
    const defaultLabel = ctx.node.data.switch?.defaultLabel ?? "default";
    if (!routes.some((edge) => (edge.label ?? "default") === defaultLabel)) {
      ctx.errors.push(`Switch ${ctx.node.id} requires a route edge labeled "${defaultLabel}".`);
    }
  }
};
