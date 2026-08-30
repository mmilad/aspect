import type { WorkflowPreset } from "../types";
import { authorWorkflowGraph } from "./graph";

export const authorWorkflowPreset: WorkflowPreset = {
  presetKey: "author_workflow",
  presetVersion: 3,
  title: "Author workflow (outline → JSON)",
  summary:
    "Two LLM steps: write a text outline, then compile it to Workflow Step Graph v4 JSON.",
  body: [
    "Bag: brief (required), title, reason optional.",
    "Step 1 writes `outline` (plain text / numbered pseudo steps).",
    "Step 2 writes `graphJson` (JSON string of { version, variables, nodes, edges }).",
    "Port contracts live on nodes; inputBindings/writeBindings are identity by default.",
    "Each LLM step has systemPrompt (role rules) + task instructions (bag templates).",
    "Run via run_workflow key=author_workflow; on pending_llm resume with llmWrites.",
    "Prefer this over one-shot generate for local models.",
    "Refresh seeded DB with: pnpm plan presets-ensure --force"
  ].join("\n"),
  status: "accepted",
  kind: "builder",
  graph: authorWorkflowGraph,
  supportsTargetSlug: "should-author-executable-workflow-step-graphs"
};
