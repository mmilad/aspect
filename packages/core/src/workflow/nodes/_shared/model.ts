import type { BagShape, WorkflowNode, WorkflowNodeData, WorkflowNodeKind, WorkflowNodeType } from "./types";
import type { WorkflowEdge } from "../../graph/types";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";
import type { WorkflowInspectorField } from "./inspector";

export interface NodeTopologyContext {
  node: WorkflowNode;
  graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  incoming: WorkflowEdge[];
  outgoing: WorkflowEdge[];
  errors: string[];
}

export interface WorkflowNodeModel {
  type: WorkflowNodeType;
  kind: WorkflowNodeKind;
  description?: string;
  execInputs?: (node: WorkflowNode) => string[];
  execOutputs?: (node: WorkflowNode) => string[];
  execInputDescriptions?: (node: WorkflowNode) => Record<string, string>;
  execOutputDescriptions?: (node: WorkflowNode) => Record<string, string>;
  dataInputs?: (node: WorkflowNode) => string[];
  dataOutputs?: (node: WorkflowNode) => string[];
  canvasFields?: (node: WorkflowNode) => Array<{ label: string; value: string }>;
  /** Config key on data for this type, if any */
  configKey?: keyof WorkflowNodeData;
  defaultData: () => WorkflowNodeData;
  parseConfig: (raw: Record<string, unknown>, nodeId: string, errors: string[]) => Partial<WorkflowNodeData>;
  validateTopology?: (ctx: NodeTopologyContext) => void;
  inferOutputs?: (node: WorkflowNode) => Record<string, BagShape>;
  execute?: (ctx: NodeExecuteContext) => Promise<WorkflowStepResult>;
  inspectorFields?: WorkflowInspectorField[];
}
