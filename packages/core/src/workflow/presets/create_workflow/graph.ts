import { WORKFLOW_STEP_LIST_V1_KEY } from "../../llm/llm-json-schemas";
import { WORKFLOW_SCHEMA_VERSION, type WorkflowNode } from "../../nodes";
import type { WorkflowEdge, WorkflowGraph } from "../../graph";

const STRING = { kind: "primitive" as const, type: "string" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };
const JSON_SHAPE = { kind: "any" as const };

function data(
  id: string,
  source: string,
  sourcePin: string,
  target: string,
  targetPin: string
): WorkflowEdge {
  return { id, source, target, kind: "data", sourcePin, targetPin };
}

function knot(id: string, x: number, y: number): WorkflowNode {
  return { id, type: "reroute", position: { x, y }, data: { title: "Reroute" } };
}

/**
 * Minimal create_workflow: plan step instructions, run create_step per item, assemble a fragment.
 */
export const createWorkflowGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "brief", role: "input", shape: STRING, required: true },
    { name: "availableBagShape", role: "input", shape: JSON_SHAPE, required: false },
    { name: "allowedNodeTypes", role: "input", shape: JSON_SHAPE, required: false },
    { name: "workflowDraft", role: "output", shape: JSON_SHAPE, required: true }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 220 },
      data: {
        title: "Start",
        outputContracts: {
          brief: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE }
        }
      }
    },
    knot("r_brief", 210, 260),
    knot("r_available_bag_shape", 210, 320),
    knot("r_allowed_node_types", 210, 380),
    {
      id: "plan_steps",
      type: "llm",
      position: { x: 360, y: 220 },
      data: {
        title: "Plan steps",
        inputs: {
          brief: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE }
        },
        outputContracts: {
          stepInstructionsList: { required: true, shape: STRING_ARRAY }
        },
        llm: {
          schemaKey: WORKFLOW_STEP_LIST_V1_KEY,
          outputSchema: ["stepInstructionsList"],
          instructions: [
            "Turn the workflow brief into create_step instructions for this layer's sequential work spine.",
            "Return workflow_step_list_v1 JSON with stepInstructionsList: string[].",
            "What this list is: the current-layer spine, not the expanded runtime. Nested loops, subworkflows, and repeated items can become hundreds of runtime steps later. Do not unroll them here.",
            "Brief rules (must follow):",
            "- Emit at least 2 work nodes. One-node graphs are not allowed. There is no maximum.",
            "- Emit as many distinct sequential stages as the brief needs. Prefer a compact spine; group tiny ops. Do not copy the same node once per list item or loop iteration.",
            "- Start each string with `Title: <unique title>.` Titles must be unique in this list (they become node ids). Never reuse Math, Step, or untitled.",
            "- Each string describes exactly one node. Do not include start or end.",
            "- Sequential spine only: no foreach, branch, switch, fork, join, or subworkflow until assembly can wire them. If the brief needs repetition or a nested graph, describe that stage once (what one item does, what it reads/writes).",
            "- Name bag keys in each instruction (what it reads, what it writes) so later steps can consume earlier writes.",
            "- Only use keys from availableBagShape, plus new keys that earlier steps in this list write.",
            "- Prefer math, transform, map, and push. Use llm only when the brief needs a judgment.",
            "- Respect allowedNodeTypes when provided; never emit a type outside that list.",
            "Do not emit edges, graph JSON, or node plans.",
            "Brief: {{brief}}",
            "Available bag shape: {{availableBagShape}}",
            "Allowed node types: {{allowedNodeTypes}}"
          ].join("\n")
        }
      }
    },
    {
      id: "foreach_steps",
      type: "foreach",
      position: { x: 900, y: 220 },
      data: {
        title: "Each step",
        inputs: {
          stepInstructionsList: { required: true, shape: STRING_ARRAY }
        },
        foreach: {
          itemsFrom: "stepInstructionsList",
          itemKey: "stepInstructions",
          indexKey: "stepIndex"
        }
      }
    },
    {
      id: "run_create_step",
      type: "subworkflow",
      position: { x: 900, y: 460 },
      data: {
        title: "Create step",
        inputs: {
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE }
        },
        outputContracts: {
          stepDraft: { required: true, shape: JSON_SHAPE }
        },
        subworkflow: {
          workflowId: "create_step",
          inputMap: {
            stepInstructions: "stepInstructions",
            availableBagShape: "availableBagShape",
            allowedNodeTypes: "allowedNodeTypes"
          },
          outputMap: {
            stepDraft: "stepDraft"
          }
        }
      }
    },
    {
      id: "collect_draft",
      type: "push",
      position: { x: 1180, y: 460 },
      data: {
        title: "Collect draft",
        inputs: {
          stepDrafts: { required: false, shape: JSON_SHAPE },
          stepDraft: { required: true, shape: JSON_SHAPE }
        },
        outputContracts: {
          stepDrafts: { required: true, shape: JSON_SHAPE }
        },
        push: {
          target: "stepDrafts",
          valueFrom: "stepDraft"
        }
      }
    },
    {
      id: "assemble_fragment",
      type: "assemble_fragment",
      position: { x: 1460, y: 220 },
      data: {
        title: "Assemble fragment",
        inputs: {
          stepDrafts: { required: true, shape: JSON_SHAPE }
        },
        outputContracts: {
          workflowDraft: { required: true, shape: JSON_SHAPE }
        },
        assembleFragment: {
          draftsFrom: "stepDrafts",
          outputKey: "workflowDraft"
        }
      }
    },
    {
      id: "end",
      type: "end",
      position: { x: 1740, y: 220 },
      data: {
        title: "End",
        inputs: {
          workflowDraft: { required: true, shape: JSON_SHAPE }
        }
      }
    }
  ],
  edges: [
    { id: "e_start_plan", source: "start", target: "plan_steps", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_plan_foreach", source: "plan_steps", target: "foreach_steps", kind: "next", sourcePin: "then", targetPin: "in" },
    {
      id: "e_foreach_loop",
      source: "foreach_steps",
      target: "run_create_step",
      kind: "route",
      label: "loop",
      sourcePin: "loop",
      targetPin: "in"
    },
    { id: "e_run_collect", source: "run_create_step", target: "collect_draft", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_collect_foreach", source: "collect_draft", target: "foreach_steps", kind: "next", sourcePin: "then", targetPin: "in" },
    {
      id: "e_foreach_done",
      source: "foreach_steps",
      target: "assemble_fragment",
      kind: "route",
      label: "completed",
      sourcePin: "completed",
      targetPin: "in"
    },
    { id: "e_assemble_end", source: "assemble_fragment", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
    data("d_start_r_brief", "start", "brief", "r_brief", "value"),
    data("d_r_brief_plan", "r_brief", "value", "plan_steps", "brief"),
    data("d_start_r_shape", "start", "availableBagShape", "r_available_bag_shape", "value"),
    data("d_r_shape_plan", "r_available_bag_shape", "value", "plan_steps", "availableBagShape"),
    data("d_r_shape_step", "r_available_bag_shape", "value", "run_create_step", "availableBagShape"),
    data("d_start_r_types", "start", "allowedNodeTypes", "r_allowed_node_types", "value"),
    data("d_r_types_plan", "r_allowed_node_types", "value", "plan_steps", "allowedNodeTypes"),
    data("d_r_types_step", "r_allowed_node_types", "value", "run_create_step", "allowedNodeTypes"),
    data("d_plan_foreach", "plan_steps", "stepInstructionsList", "foreach_steps", "stepInstructionsList"),
    data("d_run_collect", "run_create_step", "stepDraft", "collect_draft", "stepDraft"),
    data("d_collect_assemble", "collect_draft", "stepDrafts", "assemble_fragment", "stepDrafts"),
    data("d_assemble_end", "assemble_fragment", "workflowDraft", "end", "workflowDraft")
  ]
};

