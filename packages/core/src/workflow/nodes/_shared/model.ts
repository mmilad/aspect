import type { BagShape, WorkflowNode, WorkflowNodeData, WorkflowNodeKind, WorkflowNodeType } from "./types";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";
import type { WorkflowInspectorField } from "./inspector";

export interface NodeTopologyContext {
  node: WorkflowNode;
  graph: {
    nodes: WorkflowNode[];
    edges: Array<{ id: string; source: string; target: string; kind: string; label?: string }>;
  };
  incoming: Array<{ id: string; source: string; target: string; kind: string; label?: string }>;
  outgoing: Array<{ id: string; source: string; target: string; kind: string; label?: string }>;
  errors: string[];
}

export interface WorkflowNodeModel {
  type: WorkflowNodeType;
  kind: WorkflowNodeKind;
  /** Config key on data for this type, if any */
  configKey?: keyof WorkflowNodeData;
  defaultData: () => WorkflowNodeData;
  parseConfig: (raw: Record<string, unknown>, nodeId: string, errors: string[]) => Partial<WorkflowNodeData>;
  validateTopology?: (ctx: NodeTopologyContext) => void;
  inferOutputs?: (node: WorkflowNode) => Record<string, BagShape>;
  execute?: (ctx: NodeExecuteContext) => Promise<WorkflowStepResult>;
  inspectorFields?: WorkflowInspectorField[];
}
