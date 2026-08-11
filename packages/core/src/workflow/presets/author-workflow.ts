import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import { identityBindings } from "./bindings";
import type { WorkflowPreset } from "./types";
import {
  buildWorkflowCompileSystemPrompt,
  buildWorkflowOutlineSystemPrompt
} from "../author";

const STRING = { kind: "primitive" as const, type: "string" as const };

/**
 * Two-step authoring: LLM outline (text) → LLM compile (JSON graph).
 * Both intermediates land in the bag so Story / inspector / run can show them.
 * Ports are fixed; bindings are identity (UI may remap bag keys).
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
        writeBindings: identityBindings(["brief", "title", "reason"]),
        outputContracts: {
          brief: { required: true, shape: STRING },
          title: { required: false, shape: STRING },
          reason: { required: false, shape: STRING }
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
        inputs: {
          brief: { required: true, shape: STRING },
          title: { required: false, shape: STRING }
        },
        inputBindings: identityBindings(["brief", "title"]),
        writes: ["outline"],
        writeBindings: identityBindings(["outline"]),
        outputContracts: {
          outline: { required: true, shape: STRING }
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
        inputs: {
          brief: { required: true, shape: STRING },
          title: { required: false, shape: STRING },
          outline: { required: true, shape: STRING }
        },
        inputBindings: identityBindings(["brief", "title", "outline"]),
        writes: ["graphJson"],
        writeBindings: identityBindings(["graphJson"]),
        outputContracts: {
          graphJson: { required: true, shape: STRING }
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
  presetVersion: 3,
  title: "Author workflow (outline → JSON)",
  summary:
    "Two LLM steps: write a text outline, then compile it to Workflow Step Graph v2 JSON.",
  body: [
    "Bag: brief (required), title, reason optional.",
    "Step 1 writes `outline` (plain text / numbered pseudo steps).",
    "Step 2 writes `graphJson` (JSON string of { version, nodes, edges }).",
    "Port contracts live on nodes; inputBindings/writeBindings are identity by default.",
    "Each LLM step has systemPrompt (role rules) + task instructions (bag templates).",
    "Run via run_workflow key=author_workflow; on pending_llm resume with llmWrites.",
    "Prefer this over one-shot generate for local models.",
    "Refresh seeded DB with: pnpm plan presets-ensure --force"
  ].join("\n"),
  status: "accepted",
  graph: authorWorkflowGraph,
  supportsTargetSlug: "should-author-executable-workflow-step-graphs"
};
