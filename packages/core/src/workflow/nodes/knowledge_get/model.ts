import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeKnowledgeGet } from "./execute";
import { parseKnowledgeGetNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NULLABLE_ITEM: BagShape = { kind: "union", options: [{ kind: "ref", ref: "Json" }, { kind: "primitive", type: "null" }] };

export const knowledgeGetNode: WorkflowNodeModel = {
  type: "knowledge_get",
  kind: "work",
  category: "operation",
  sideEffect: "read",
  configKey: "knowledgeGet",
  defaultData: () => ({
    title: "Get Knowledge Item",
    inputs: {
      datasetKey: { required: true, shape: STRING },
      itemId: { required: true, shape: STRING },
      includeDeleted: { required: false, shape: BOOLEAN },
      access: { required: false, shape: { kind: "any" } }
    },
    outputContracts: {
      item: { required: true, shape: NULLABLE_ITEM },
      found: { required: true, shape: BOOLEAN }
    },
    knowledgeGet: {}
  }),
  parseConfig: parseKnowledgeGetNodeConfig,
  execute: executeKnowledgeGet,
  dataInputs: () => ["datasetKey", "itemId", "includeDeleted", "access"],
  dataOutputs: () => ["item", "found"],
  execInputDescriptions: () => ({ in: "Read one visible knowledge item." }),
  execOutputDescriptions: () => ({ then: "Continue with the item or a not-found result." }),
  canvasFields: () => [{ label: "capability", value: "knowledge.get" }]
};
