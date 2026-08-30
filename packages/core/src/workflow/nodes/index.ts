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
  WorkflowAssembleFragmentConfig,
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
  WorkflowQueryConfig,
  WorkflowQueryKind,
  WorkflowQueryOp,
  WorkflowQuerySlot,
  WorkflowQuerySlotKind,
  WorkflowQuerySlotOp,
  WorkflowQuerySlotRel,
  WorkflowQuerySlotSource,
  WorkflowRetryOn,
  WorkflowRerouteNodeType,
  WorkflowSubworkflowConfig,
  WorkflowSwitchConfig,
  WorkflowToolConfig,
  WorkflowVariableNodeType,
  WorkflowWaitConfig,
  WorkflowWorkNodeType,
  WorkflowWriteConfig
} from "./_shared/types";

export {
  bagShapeCatalogRefs,
  queryOps,
  querySlotKinds,
  WORKFLOW_SCHEMA_VERSION,
  workflowControlNodeTypes,
  workflowEdgeKinds,
  workflowLlmFormats,
  workflowNodeTypes,
  workflowRetryOnValues,
  workflowRerouteNodeTypes,
  workflowVariableNodeTypes,
  workflowWorkNodeTypes
} from "./_shared/types";

export {
  applyQueryPorts,
  defaultSlotsForOp,
  effectiveSlots,
  pinsForQuery,
  portsForQuery,
  QUERY_CATALOG,
  QUERY_FIELD_NAMES,
  queryEntityTypes,
  queryOpSpec,
  querySlotFieldOps,
  uniqueSlotId,
  withQueryConfig
} from "./query/catalog";

export type { QueryConstField, QueryOpSpec, QueryPin } from "./query/catalog";
export type { NodeTopologyContext, WorkflowNodeModel } from "./_shared/model";
export type { WorkflowInspectorField } from "./_shared/inspector";
export { getDataPath, setDataPath } from "./_shared/inspector";

export { getNodeModel, workflowNodeModels } from "./registry";
export { isPureDataNodeType } from "./_shared/pure";
export { walkNeighborhood } from "./query/neighborhood";

import * as catalog from "./query/catalog";
import * as inspector from "./_shared/inspector";
import * as neighborhood from "./query/neighborhood";
import * as registry from "./registry";
import * as sharedTypes from "./_shared/types";
import { isPureDataNodeType } from "./_shared/pure";

const nodes = {
  get getNodeModel() {
    return registry.getNodeModel;
  },
  get workflowNodeModels() {
    return registry.workflowNodeModels;
  },
  walkNeighborhood: neighborhood.walkNeighborhood,
  getDataPath: inspector.getDataPath,
  setDataPath: inspector.setDataPath,
  applyQueryPorts: catalog.applyQueryPorts,
  defaultSlotsForOp: catalog.defaultSlotsForOp,
  effectiveSlots: catalog.effectiveSlots,
  pinsForQuery: catalog.pinsForQuery,
  portsForQuery: catalog.portsForQuery,
  QUERY_CATALOG: catalog.QUERY_CATALOG,
  QUERY_FIELD_NAMES: catalog.QUERY_FIELD_NAMES,
  queryEntityTypes: catalog.queryEntityTypes,
  queryOpSpec: catalog.queryOpSpec,
  querySlotFieldOps: catalog.querySlotFieldOps,
  uniqueSlotId: catalog.uniqueSlotId,
  withQueryConfig: catalog.withQueryConfig,
  bagShapeCatalogRefs: sharedTypes.bagShapeCatalogRefs,
  queryOps: sharedTypes.queryOps,
  querySlotKinds: sharedTypes.querySlotKinds,
  WORKFLOW_SCHEMA_VERSION: sharedTypes.WORKFLOW_SCHEMA_VERSION,
  workflowControlNodeTypes: sharedTypes.workflowControlNodeTypes,
  workflowEdgeKinds: sharedTypes.workflowEdgeKinds,
  workflowLlmFormats: sharedTypes.workflowLlmFormats,
  workflowNodeTypes: sharedTypes.workflowNodeTypes,
  workflowRetryOnValues: sharedTypes.workflowRetryOnValues,
  workflowRerouteNodeTypes: sharedTypes.workflowRerouteNodeTypes,
  workflowVariableNodeTypes: sharedTypes.workflowVariableNodeTypes,
  workflowWorkNodeTypes: sharedTypes.workflowWorkNodeTypes,
  isPureDataNodeType
};

export default nodes;
