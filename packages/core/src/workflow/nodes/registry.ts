import type { WorkflowNodeModel } from "./_shared/model";
import type { WorkflowNodeType } from "./_shared/types";
import { branchNode } from "./branch/model";
import { breakNode } from "./break/model";
import { contextNode } from "./context/model";
import { delegateNode } from "./delegate/model";
import { assembleFragmentNode } from "./assemble_fragment/model";
import { assistantSessionNode } from "./assistant_session/model";
import { createWorkflowNodeNode } from "./create_workflow_node/model";
import { endNode } from "./end/model";
import { errorEndNode } from "./error_end/model";
import { foreachNode } from "./foreach/model";
import { forkNode } from "./fork/model";
import { gateNode } from "./gate/model";
import { joinNode } from "./join/model";
import { llmNode } from "./llm/model";
import { mapNode } from "./map/model";
import { mathNode } from "./math/model";
import { queryNode } from "./query/model";
import { pushNode } from "./push/model";
import { getNode } from "./get/model";
import { rerouteNode } from "./reroute/model";
import { setNode } from "./set/model";
import { templateNode } from "./template/model";
import { startNode } from "./start/model";
import { subworkflowNode } from "./subworkflow/model";
import { switchNode } from "./switch/model";
import { toolNode } from "./tool/model";
import { transformNode } from "./transform/model";
import { waitNode } from "./wait/model";
import { writeNode } from "./write/model";
import { webSearchNode } from "./web_search/model";

export const workflowNodeModels: Record<WorkflowNodeType, WorkflowNodeModel> = {
  start: startNode,
  end: endNode,
  error_end: errorEndNode,
  branch: branchNode,
  break: breakNode,
  switch: switchNode,
  fork: forkNode,
  join: joinNode,
  foreach: foreachNode,
  gate: gateNode,
  wait: waitNode,
  subworkflow: subworkflowNode,
  tool: toolNode,
  delegate: delegateNode,
  llm: llmNode,
  create_workflow_node: createWorkflowNodeNode,
  assemble_fragment: assembleFragmentNode,
  assistant_session: assistantSessionNode,
  context: contextNode,
  transform: transformNode,
  map: mapNode,
  math: mathNode,
  query: queryNode,
  write: writeNode,
  push: pushNode,
  get: getNode,
  set: setNode,
  template: templateNode,
  reroute: rerouteNode,
  web_search: webSearchNode
};

export function getNodeModel(type: WorkflowNodeType): WorkflowNodeModel {
  return workflowNodeModels[type];
}

export {
  workflowControlNodeTypes,
  workflowNodeTypes,
  workflowRerouteNodeTypes,
  workflowVariableNodeTypes,
  workflowWorkNodeTypes
} from "./_shared/types";
