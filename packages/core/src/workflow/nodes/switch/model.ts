import type { WorkflowNodeModel } from "../_shared/model";
import { executeSwitch } from "./execute";
import { switchInspectorFields } from "./inspector";
import { parseSwitchNodeConfig } from "./schema";

export const switchNode: WorkflowNodeModel = {
  type: "switch",
  kind: "control",
  description: "Reads one bag value and follows the matching output pin, or default.",
  configKey: "switch",
  defaultData: () => ({ title: "Switch", reads: [], switch: { defaultLabel: "default" } }),
  parseConfig: parseSwitchNodeConfig,
  execute: executeSwitch,
  inspectorFields: switchInspectorFields,
  validateTopology: (ctx) => {
    const routes = ctx.outgoing.filter((edge) => edge.kind === "route" || edge.sourcePin);
    if (routes.length < 2) {
      ctx.errors.push(`Switch ${ctx.node.id} requires at least two route edges.`);
    }
    const labels = routes.map((edge) => edge.sourcePin ?? edge.label ?? "");
    if (new Set(labels).size !== labels.length) {
      ctx.errors.push(`Switch ${ctx.node.id} route labels must be unique.`);
    }
    const defaultLabel = ctx.node.data.switch?.defaultLabel ?? "default";
    if (!routes.some((edge) => (edge.sourcePin ?? edge.label ?? "default") === defaultLabel)) {
      ctx.errors.push(`Switch ${ctx.node.id} requires a route edge labeled "${defaultLabel}".`);
    }
  },
  execInputs: () => ["in"],
  execOutputs: (node) => [...(node.data.switch?.cases ?? []), node.data.switch?.defaultLabel ?? "default"],
  execInputDescriptions: () => ({
    in: "Evaluate the switch value."
  }),
  execOutputDescriptions: (node) =>
    Object.fromEntries(
      [...(node.data.switch?.cases ?? []), node.data.switch?.defaultLabel ?? "default"].map((pin) => [
        pin,
        pin === (node.data.switch?.defaultLabel ?? "default")
          ? "Fallback when no case matches."
          : `Runs when the value equals "${pin}".`
      ])
    ),
  dataInputs: (node) => [node.data.switch?.on].filter(Boolean) as string[],
  canvasFields: (node) => [
    { label: "on", value: node.data.switch?.on ?? "type" },
    { label: "default", value: node.data.switch?.defaultLabel ?? "default" }
  ]
};
