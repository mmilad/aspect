import type { WorkflowNodeModel } from "../_shared/model";
import { applyQueryPorts, pinsForQuery } from "./catalog";
import { executeQuery } from "./execute";
import { queryInspectorFields } from "./inspector";
import { parseQueryNodeConfig } from "./schema";

export const queryNode: WorkflowNodeModel = {
  type: "query",
  kind: "work",
  description: "Read, filter, or write graph entities. Data pins follow query.op and query.type.",
  configKey: "query",
  defaultData: () =>
    applyQueryPorts({
      title: "Query",
      query: { op: "list" }
    }),
  parseConfig: parseQueryNodeConfig,
  execute: executeQuery,
  inspectorFields: queryInspectorFields,
  dataInputs: (node) => (node.data.query ? pinsForQuery(node.data.query).inputs.map((pin) => pin.id) : []),
  dataOutputs: (node) => (node.data.query ? pinsForQuery(node.data.query).outputs.map((pin) => pin.id) : []),
  canvasFields: (node) => {
    const query = node.data.query;
    if (!query) {
      return [];
    }
    const fields: Array<{ label: string; value: string }> = [{ label: "op", value: query.op }];
    if (query.type) {
      fields.push({ label: "type", value: query.type });
    }
    return fields;
  },
  execInputDescriptions: () => ({
    in: "Run this graph query."
  }),
  execOutputDescriptions: () => ({
    then: "Continue after the query result is in the bag."
  })
};
