import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeKnowledgeContextIndex } from "./execute";
import { parseKnowledgeContextIndexNodeConfig } from "./schema";
import { KNOWLEDGE_CATALOG_DATASETS_SHAPE, KNOWLEDGE_CATALOG_TOOLS_SHAPE } from "./shapes";

const NUMBER: BagShape = { kind: "primitive", type: "number" };
const STRING: BagShape = { kind: "primitive", type: "string" };

export const knowledgeContextIndexNode: WorkflowNodeModel = {
  type: "knowledge_context_index",
  kind: "work",
  category: "operation",
  sideEffect: "read",
  configKey: "knowledgeContextIndex",
  defaultData: () => ({
    title: "Read knowledge context index",
    outputContracts: {
      datasets: { required: true, shape: KNOWLEDGE_CATALOG_DATASETS_SHAPE },
      tools: { required: true, shape: KNOWLEDGE_CATALOG_TOOLS_SHAPE },
      relationshipCount: { required: true, shape: NUMBER },
      usageHint: { required: true, shape: STRING }
    },
    knowledgeContextIndex: {}
  }),
  parseConfig: parseKnowledgeContextIndexNodeConfig,
  execute: executeKnowledgeContextIndex,
  dataOutputs: () => ["datasets", "tools", "relationshipCount", "usageHint"],
  execInputDescriptions: () => ({ in: "Read the compact, token-efficient knowledge catalog." }),
  execOutputDescriptions: () => ({ then: "Continue with the confirmed knowledge catalog." }),
  canvasFields: () => [{ label: "capability", value: "knowledge.context_index" }]
};
