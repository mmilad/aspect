import type { WorkflowNodeModel } from "./_shared/model";
import type { WorkflowNodeType } from "./_shared/types";
import { branchNode } from "./branch/model";
import { contextNode } from "./context/model";
import { endNode } from "./end/model";
import { errorEndNode } from "./error_end/model";
import { foreachNode } from "./foreach/model";
import { forkNode } from "./fork/model";
import { gateNode } from "./gate/model";
import { joinNode } from "./join/model";
import { llmNode } from "./llm/model";
import { mapNode } from "./map/model";
import { startNode } from "./start/model";
import { subworkflowNode } from "./subworkflow/model";
import { switchNode } from "./switch/model";
import { toolNode } from "./tool/model";
import { transformNode } from "./transform/model";
import { waitNode } from "./wait/model";
import { writeNode } from "./write/model";

export const workflowNodeModels: Record<WorkflowNodeType, WorkflowNodeModel> = {
  start: startNode,
  end: endNode,
  error_end: errorEndNode,
  branch: branchNode,
  switch: switchNode,
  fork: forkNode,
  join: joinNode,
  foreach: foreachNode,
  gate: gateNode,
  wait: waitNode,
  subworkflow: subworkflowNode,
  tool: toolNode,
  llm: llmNode,
  context: contextNode,
  transform: transformNode,
  map: mapNode,
  write: writeNode
};

export function getNodeModel(type: WorkflowNodeType): WorkflowNodeModel {
  return workflowNodeModels[type];
}

export {
  workflowControlNodeTypes,
  workflowNodeTypes,
  workflowWorkNodeTypes
} from "./_shared/types";
