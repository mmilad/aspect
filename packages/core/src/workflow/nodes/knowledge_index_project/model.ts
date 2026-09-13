import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeKnowledgeIndexProject } from "./execute";
import { parseKnowledgeIndexProjectNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const STRINGS: BagShape = { kind: "array", items: STRING };

export const knowledgeIndexProjectNode: WorkflowNodeModel = {
  type: "knowledge_index_project",
  kind: "work",
  category: "operation",
  sideEffect: "write",
  configKey: "knowledgeIndexProject",
  defaultData: () => ({
    title: "Index project knowledge",
    inputs: {
      projectKey: { required: true, shape: STRING },
      datasetKey: { required: true, shape: STRING },
      limit: { required: false, shape: NUMBER },
      includeArchived: { required: false, shape: BOOLEAN }
    },
    outputContracts: {
      indexed: { required: true, shape: NUMBER },
      ids: { required: true, shape: STRINGS },
      skipped: { required: true, shape: NUMBER },
      embeddingModel: { required: true, shape: NULLABLE_STRING }
    },
    knowledgeIndexProject: {}
  }),
  parseConfig: parseKnowledgeIndexProjectNodeConfig,
  execute: executeKnowledgeIndexProject,
  dataInputs: () => ["projectKey", "datasetKey", "limit", "includeArchived"],
  dataOutputs: () => ["indexed", "ids", "skipped", "embeddingModel"],
  execInputDescriptions: () => ({ in: "Project graph entities into scoped knowledge memory." }),
  execOutputDescriptions: () => ({ then: "Continue with the confirmed indexing result." }),
  canvasFields: () => [{ label: "capability", value: "knowledge.index_project" }]
};
