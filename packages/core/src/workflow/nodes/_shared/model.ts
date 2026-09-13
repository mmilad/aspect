import type { BagShape, WorkflowNode, WorkflowNodeData, WorkflowNodeKind, WorkflowNodeType } from "./types";
import type { WorkflowEdge } from "../../graph/types";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";
import type { WorkflowInspectorField } from "./inspector";

export type WorkflowNodeCategory = "control" | "pure_data" | "operation" | "model" | "agent";
export type WorkflowNodeSideEffect = "none" | "read" | "delegate" | "write" | "external";

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
  category?: WorkflowNodeCategory;
  sideEffect?: WorkflowNodeSideEffect;
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

const PURE_DATA_TYPES = new Set<WorkflowNodeType>(["get", "template", "reroute", "break"]);
const CONTROL_TYPES = new Set<WorkflowNodeType>([
  "start", "end", "error_end", "branch", "switch", "fork", "join", "foreach", "gate", "wait", "subworkflow"
]);

/** Compatibility classification for serialized nodes created before explicit metadata existed. */
export function workflowNodeCategory(node: Pick<WorkflowNode, "type" | "data">): WorkflowNodeCategory {
  const explicit = (node.data as { category?: unknown }).category;
  if (explicit === "control" || explicit === "pure_data" || explicit === "operation" || explicit === "model" || explicit === "agent") {
    return explicit;
  }
  if (CONTROL_TYPES.has(node.type)) return "control";
  if (PURE_DATA_TYPES.has(node.type)) return "pure_data";
  if (node.type === "llm" || node.type === "assistant_session") return "model";
  if (node.type === "delegate") return "agent";
  return "operation";
}

/** Compatibility side-effect classification used by runtime policy checks. */
export function workflowNodeSideEffect(node: Pick<WorkflowNode, "type" | "data">): WorkflowNodeSideEffect {
  const explicit = (node.data as { sideEffect?: unknown }).sideEffect;
  if (explicit === "none" || explicit === "read" || explicit === "delegate" || explicit === "write" || explicit === "external") {
    return explicit;
  }
  if (node.type === "delegate") return "delegate";
  if (node.type === "write" || node.type === "create_workflow_node" || node.type === "assemble_fragment") return "write";
  if (node.type === "tool" || node.type === "web_search") return "external";
  if (node.type === "knowledge_search" || node.type === "knowledge_get") return "read";
  if (node.type === "knowledge_ingest" || node.type === "knowledge_ingest_text" || node.type === "knowledge_promote" || node.type === "knowledge_index_project") return "write";
  if (node.type === "file_list" || node.type === "file_read") return "read";
  if (node.type === "file_write") return "write";
  if (node.type === "query") {
    const op = node.data.query?.op;
    return op === "create_entity" || op === "update_entity" || op === "rollup_parent_status" ? "write" : "read";
  }
  if (node.type === "context") return "read";
  return "none";
}
