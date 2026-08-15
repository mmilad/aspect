/** Public workflow types — re-exported from modular nodes/ + graph/. */
export type {
  BagShape,
  BagShapeCatalogRef,
  TopologyEdgeMaps,
  TopologyEdgeRef,
  WorkflowAssignAuto,
  WorkflowAutoConfig,
  WorkflowBagKeyContract,
  WorkflowBranchConfig,
  WorkflowControlNodeType,
  WorkflowCreateWorkflowNodeConfig,
  WorkflowEdgeKind,
  WorkflowExecutionPolicy,
  WorkflowFilterAuto,
  WorkflowFilterWhere,
  WorkflowForeachBodySubgraph,
  WorkflowForeachBodySubworkflow,
  WorkflowForeachCollectConfig,
  WorkflowForeachConfig,
  WorkflowGateConfig,
  WorkflowJoinConfig,
  WorkflowJoinMergeConfig,
  WorkflowLegacyNodeType,
  WorkflowLlmConfig,
  WorkflowLlmFormat,
  WorkflowLoadContextAuto,
  WorkflowMapConfig,
  WorkflowMapField,
  WorkflowMathConfig,
  WorkflowMathOperation,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowNodeType,
  WorkflowPosition,
  WorkflowPushConfig,
  WorkflowRetryOn,
  WorkflowRerouteNodeType,
  WorkflowSubworkflowConfig,
  WorkflowSwitchConfig,
  WorkflowToolConfig,
  WorkflowWaitConfig,
  WorkflowWorkNodeType,
  WorkflowWriteConfig
} from "./nodes/_shared/types";

export {
  bagShapeCatalogRefs,
  WORKFLOW_SCHEMA_VERSION,
  workflowControlNodeTypes,
  workflowEdgeKinds,
  workflowLlmFormats,
  workflowNodeTypes,
  workflowRetryOnValues,
  workflowRerouteNodeTypes,
  workflowVariableNodeTypes,
  workflowWorkNodeTypes
} from "./nodes/_shared/types";

export type {
  WorkflowContextBag,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowParseError,
  WorkflowParseOutcome,
  WorkflowParseResult,
  WorkflowRunFrame,
  WorkflowVariable,
  WorkflowVariableRole
} from "./graph/types";

export type { NodeTopologyContext, WorkflowNodeModel } from "./nodes/_shared/model";
export { getNodeModel, workflowNodeModels } from "./nodes/registry";
export type { WorkflowInspectorField } from "./nodes/_shared/inspector";
export { getDataPath, setDataPath } from "./nodes/_shared/inspector";
