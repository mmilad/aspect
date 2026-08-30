export * from "./mermaid";
export * from "./story";
export * from "./layout";

import { layoutWorkflowGraph } from "./layout";
import {
  mermaidIdLookup,
  mermaidNodeId,
  renderWorkflowMermaid,
  workflowIdFromMermaidDomId
} from "./mermaid";
import { renderWorkflowStory } from "./story";

const views = {
  mermaidNodeId,
  mermaidIdLookup,
  workflowIdFromMermaidDomId,
  renderWorkflowMermaid,
  renderWorkflowStory,
  layoutWorkflowGraph
};

export default views;
