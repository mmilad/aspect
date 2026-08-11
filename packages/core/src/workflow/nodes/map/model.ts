import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeMap } from "./execute";
import { mapInspectorFields } from "./inspector";
import { parseMapNodeConfig } from "./schema";

export const mapNode: WorkflowNodeModel = {
  type: "map",
  kind: "work",
  configKey: "map",
  defaultData: () => ({
    title: "Map",
    reads: [],
    writes: [],
    map: { from: "", as: "", fields: [] }
  }),
  parseConfig: parseMapNodeConfig,
  execute: executeMap,
  inspectorFields: mapInspectorFields,
  validateTopology: (ctx) => {
    if (!ctx.node.data.map?.from || !ctx.node.data.map.as || !ctx.node.data.map.fields?.length) {
      ctx.errors.push(`Map ${ctx.node.id} requires map.from, map.as, and map.fields.`);
    }
  },
  inferOutputs: (node) => {
    const map = node.data.map;
    if (!map) {
      return {};
    }
    const fields: Record<string, BagShape> = {};
    for (const field of map.fields) {
      fields[field.as] = { kind: "unknown" };
    }
    const projected: BagShape = { kind: "object", fields };
    const mode = map.mode ?? "array";
    return {
      [map.as]: mode === "array" ? { kind: "array", items: projected } : projected
    };
  }
};
