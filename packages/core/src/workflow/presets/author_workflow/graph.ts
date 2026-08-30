import type { WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../nodes";
import { identityBindings } from "../bindings";
import {
  buildWorkflowCompileSystemPrompt,
  buildWorkflowOutlineSystemPrompt
} from "../../../generator/author";

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
            "Write key `graphJson` only: the full Workflow Step Graph v4 as a JSON string",
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

