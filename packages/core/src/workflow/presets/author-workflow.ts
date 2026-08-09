import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import type { WorkflowPreset } from "./types";
import {
  buildWorkflowCompileSystemPrompt,
  buildWorkflowOutlineSystemPrompt
} from "../author";

/**
 * Two-step authoring: LLM outline (text) → LLM compile (JSON graph).
 * Both intermediates land in the bag so Story / inspector / run can show them.
 */
export const authorWorkflowGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 120 },
      data: {
        title: "Start",
        writes: ["brief", "title", "reason"],
        outputContracts: {
          brief: { required: true, shape: { kind: "primitive", type: "string" } },
          title: { required: false, shape: { kind: "primitive", type: "string" } },
          reason: { required: false, shape: { kind: "primitive", type: "string" } }
        }
      }
    },
    {
      id: "outline",
      type: "llm",
      position: { x: 280, y: 120 },
      data: {
        title: "Outline as text",
        reads: ["brief", "title"],
        writes: ["outline"],
        outputContracts: {
          outline: { required: true, shape: { kind: "primitive", type: "string" } }
        },
        llm: {
          systemPrompt: buildWorkflowOutlineSystemPrompt(),
          instructions: [
            "Workflow title: {{title}}",
            "User brief:",
            "{{brief}}",
            "",
            "Write key `outline` only: a numbered pseudo-code / bullet list of workflow steps.",
            "No JSON. No markdown fences."
          ].join("\n"),
          inputKeys: ["brief", "title"],
          outputSchema: ["outline"],
          tools: []
        }
      }
    },
    {
      id: "compile",
      type: "llm",
      position: { x: 520, y: 120 },
      data: {
        title: "Compile to JSON",
        reads: ["brief", "title", "outline"],
        writes: ["graphJson"],
        outputContracts: {
          graphJson: { required: true, shape: { kind: "primitive", type: "string" } }
        },
        llm: {
          systemPrompt: buildWorkflowCompileSystemPrompt(),
          instructions: [
            "Workflow title: {{title}}",
            "Original brief:",
            "{{brief}}",
            "",
            "Outline to compile:",
            "{{outline}}",
            "",
            "Write key `graphJson` only: the full Workflow Step Graph v2 as a JSON string",
            "(single object with version, nodes, edges). No prose outside the JSON."
          ].join("\n"),
          inputKeys: ["brief", "title", "outline"],
          outputSchema: ["graphJson"],
          tools: []
        }
      }
    },
    {
      id: "end",
      type: "end",
      position: { x: 760, y: 120 },
      data: { title: "End" }
    }
  ],
  edges: [
    { id: "e1", source: "start", target: "outline", kind: "next" },
    { id: "e2", source: "outline", target: "compile", kind: "next" },
    { id: "e3", source: "compile", target: "end", kind: "next" }
  ]
};

export const authorWorkflowPreset: WorkflowPreset = {
  presetKey: "author_workflow",
  presetVersion: 2,
  title: "Author workflow (outline → JSON)",
  summary:
    "Two LLM steps: write a text outline, then compile it to Workflow Step Graph v2 JSON.",
  body: [
    "Bag: brief (required), title, reason optional.",
    "Step 1 writes `outline` (plain text / numbered pseudo steps).",
    "Step 2 writes `graphJson` (JSON string of { version, nodes, edges }).",
    "Each LLM step has systemPrompt (role rules) + task instructions (bag templates).",
    "Run via run_workflow key=author_workflow; on pending_llm resume with llmWrites.",
    "Prefer this over one-shot generate for local models."
  ].join("\n"),
  status: "accepted",
  graph: authorWorkflowGraph,
  supportsTargetSlug: "should-author-executable-workflow-step-graphs"
};
