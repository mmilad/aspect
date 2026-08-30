import { identityBindings } from "../bindings";
import { PLAN_V1_DOCUMENT_KIND } from "../../../planning";
import { PLAN_CLASSIFY_V1_KEY, PLAN_EXPAND_V1_KEY } from "../../../planning";
import type { WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../nodes";

const STRING = { kind: "primitive" as const, type: "string" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };
const JSON_SHAPE = { kind: "any" as const };
const START_PORTS = ["task", "constraints", "context", "success", "budget", "targetTaskId"];

export const goalPlanningGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 180 },
      data: {
        title: "Start",
        writes: START_PORTS,
        writeBindings: identityBindings(START_PORTS),
        outputContracts: {
          task: { required: true, shape: STRING },
          constraints: { required: false, shape: STRING_ARRAY },
          context: { required: false, shape: JSON_SHAPE },
          success: { required: false, shape: STRING },
          budget: { required: false, shape: JSON_SHAPE },
          targetTaskId: { required: false, shape: STRING }
        }
      }
    },
    {
      id: "seed",
      type: "transform",
      position: { x: 260, y: 180 },
      data: {
        title: "Seed plan.v1",
        reads: START_PORTS,
        inputs: {
          task: { required: true, shape: STRING },
          constraints: { required: false, shape: STRING_ARRAY },
          context: { required: false, shape: JSON_SHAPE },
          success: { required: false, shape: STRING },
          budget: { required: false, shape: JSON_SHAPE },
          targetTaskId: { required: false, shape: STRING }
        },
        writes: ["plan"],
        writeBindings: identityBindings(["plan"]),
        outputContracts: { plan: { required: true, shape: JSON_SHAPE } },
        auto: { assign: { plan: { op: "seed" } } }
      }
    },
    {
      id: "pick",
      type: "transform",
      position: { x: 500, y: 180 },
      data: {
        title: "Pick frontier",
        reads: ["plan"],
        inputs: { plan: { required: true, shape: JSON_SHAPE } },
        writes: ["plan", "frontierId", "route", "applyError"],
        writeBindings: identityBindings(["plan", "frontierId", "route", "applyError"]),
        outputContracts: {
          plan: { required: true, shape: JSON_SHAPE },
          frontierId: { required: false, shape: STRING },
          route: { required: true, shape: STRING },
          applyError: { required: false, shape: STRING }
        },
        auto: { assign: { plan: { op: "pickFrontier" } } },
        executionPolicy: { maxVisits: 24, onExhausted: "fail_run" }
      }
    },
    {
      id: "should_halt",
      type: "switch",
      position: { x: 740, y: 180 },
      data: {
        title: "Halt?",
        reads: ["route"],
        inputs: { route: { required: true, shape: STRING } },
        switch: { on: "route", cases: ["classify"], defaultLabel: "halt" }
      }
    },
    {
      id: "classify",
      type: "llm",
      position: { x: 980, y: 80 },
      data: {
        title: "Classify frontier",
        reads: ["plan", "frontierId", "task", "constraints", "context", "success", "applyError"],
        inputs: {
          plan: { required: true, shape: JSON_SHAPE },
          frontierId: { required: true, shape: STRING },
          task: { required: true, shape: STRING },
          constraints: { required: false, shape: STRING_ARRAY },
          context: { required: false, shape: JSON_SHAPE },
          success: { required: false, shape: STRING },
          applyError: { required: false, shape: STRING }
        },
        writes: ["classify"],
        writeBindings: identityBindings(["classify"]),
        outputContracts: { classify: { required: true, shape: JSON_SHAPE } },
        llm: {
          schemaKey: PLAN_CLASSIFY_V1_KEY,
          outputSchema: ["classify"],
          instructions: [
            "Classify the frontier todo. Return plan_classify_v1 JSON.",
            "nodeId MUST equal {{frontierId}} exactly — never a plan id (p_…).",
            "If applyError is non-empty, the previous JSON was rejected: {{applyError}}. Fix that error.",
            "status is atomic | needs_question | needs_decision | needs_subplan | dropped.",
            "atomic requires acceptance (min 1). needs_question requires question { kind, text }.",
            "needs_subplan only when this frontier names two or more distinct capabilities that cannot share one acceptance line.",
            "The product-scale ROOT brief may be needs_subplan. Child todos default to atomic, needs_question, or needs_decision.",
            "Visual polish, spacing, theming, look-and-feel, 2px, or 'looks nice' is atomic or needs_question — never needs_subplan.",
            "needs_decision for a real product fork (capture vs import, local vs cloud). needs_question for a missing fact.",
            "Do not invent a subplan for a 2px-style change.",
            "Task: {{task}}",
            "Success: {{success}}",
            "Frontier: {{frontierId}}",
            "Plan: {{plan}}"
          ].join("\n")
        }
      }
    },
    {
      id: "apply_classify",
      type: "transform",
      position: { x: 1220, y: 80 },
      data: {
        title: "Apply classify",
        reads: ["plan", "classify", "frontierId"],
        inputs: {
          plan: { required: true, shape: JSON_SHAPE },
          classify: { required: true, shape: JSON_SHAPE },
          frontierId: { required: false, shape: STRING }
        },
        writes: ["plan", "route", "frontierId", "applyError"],
        writeBindings: identityBindings(["plan", "route", "frontierId", "applyError"]),
        outputContracts: {
          plan: { required: true, shape: JSON_SHAPE },
          route: { required: true, shape: STRING },
          frontierId: { required: false, shape: STRING },
          applyError: { required: false, shape: STRING }
        },
        auto: { assign: { plan: { op: "applyClassify" } } }
      }
    },
    {
      id: "status_branch",
      type: "switch",
      position: { x: 1460, y: 80 },
      data: {
        title: "Status",
        reads: ["route"],
        inputs: { route: { required: true, shape: STRING } },
        switch: {
          on: "route",
          cases: ["atomic", "dropped", "needs_question", "needs_decision", "needs_subplan"],
          defaultLabel: "retry"
        }
      }
    },
    {
      id: "expand",
      type: "llm",
      position: { x: 1700, y: 220 },
      data: {
        title: "Expand subplan",
        reads: ["plan", "frontierId", "task", "applyError"],
        inputs: {
          plan: { required: true, shape: JSON_SHAPE },
          frontierId: { required: true, shape: STRING },
          task: { required: true, shape: STRING },
          applyError: { required: false, shape: STRING }
        },
        writes: ["expand"],
        writeBindings: identityBindings(["expand"]),
        outputContracts: { expand: { required: true, shape: JSON_SHAPE } },
        llm: {
          schemaKey: PLAN_EXPAND_V1_KEY,
          outputSchema: ["expand"],
          instructions: [
            "Expand the needs_subplan todo. Return plan_expand_v1 JSON.",
            "parentId MUST equal {{frontierId}} exactly — never a plan id (p_…).",
            "If applyError is non-empty, the previous JSON was rejected: {{applyError}}. Fix that error.",
            "Emit 3–8 sibling slices, not the parent title plus a qualifier.",
            "Child titles must be unique and must not contain the parent todo title.",
            "dependsOn is sibling titles in this payload, or [].",
            "Task: {{task}}",
            "Frontier: {{frontierId}}",
            "Plan: {{plan}}"
          ].join("\n")
        }
      }
    },
    {
      id: "apply_expand",
      type: "transform",
      position: { x: 1940, y: 220 },
      data: {
        title: "Apply expand",
        reads: ["plan", "expand", "frontierId"],
        inputs: {
          plan: { required: true, shape: JSON_SHAPE },
          expand: { required: true, shape: JSON_SHAPE },
          frontierId: { required: false, shape: STRING }
        },
        writes: ["plan", "route", "applyError", "frontierId"],
        writeBindings: identityBindings(["plan", "route", "applyError", "frontierId"]),
        outputContracts: {
          plan: { required: true, shape: JSON_SHAPE },
          route: { required: true, shape: STRING },
          applyError: { required: false, shape: STRING },
          frontierId: { required: false, shape: STRING }
        },
        auto: { assign: { plan: { op: "applyExpand" } } }
      }
    },
    {
      id: "expand_branch",
      type: "switch",
      position: { x: 2060, y: 220 },
      data: {
        title: "Expand result",
        reads: ["route"],
        inputs: { route: { required: true, shape: STRING } },
        switch: { on: "route", cases: ["ok"], defaultLabel: "retry" }
      }
    },
    {
      id: "prepare_think",
      type: "transform",
      position: { x: 1700, y: 20 },
      data: {
        title: "Prepare Thinking",
        reads: ["plan", "frontierId"],
        inputs: {
          plan: { required: true, shape: JSON_SHAPE },
          frontierId: { required: true, shape: STRING }
        },
        writes: ["thinkTask", "thinkContext", "thinkConstraints", "thinkExpectedOutput", "thinkMaxIterations"],
        writeBindings: identityBindings([
          "thinkTask",
          "thinkContext",
          "thinkConstraints",
          "thinkExpectedOutput",
          "thinkMaxIterations"
        ]),
        outputContracts: {
          thinkTask: { required: true, shape: STRING },
          thinkContext: { required: true, shape: JSON_SHAPE },
          thinkConstraints: { required: true, shape: STRING_ARRAY },
          thinkExpectedOutput: { required: true, shape: JSON_SHAPE },
          thinkMaxIterations: { required: true, shape: { kind: "primitive", type: "number" } }
        },
        auto: { assign: { plan: { op: "prepareThink" } } }
      }
    },
    {
      id: "think",
      type: "subworkflow",
      position: { x: 1940, y: 20 },
      data: {
        title: "Thinking",
        reads: ["thinkTask", "thinkContext", "thinkConstraints", "thinkExpectedOutput", "thinkMaxIterations"],
        inputs: {
          thinkTask: { required: true, shape: STRING },
          thinkContext: { required: true, shape: JSON_SHAPE },
          thinkConstraints: { required: true, shape: STRING_ARRAY },
          thinkExpectedOutput: { required: true, shape: JSON_SHAPE },
          thinkMaxIterations: { required: true, shape: { kind: "primitive", type: "number" } }
        },
        writes: ["thoughtDecision"],
        writeBindings: identityBindings(["thoughtDecision"]),
        outputContracts: { thoughtDecision: { required: true, shape: JSON_SHAPE } },
        subworkflow: {
          workflowId: "thinking",
          inputMap: {
            task: "thinkTask",
            context: "thinkContext",
            constraints: "thinkConstraints",
            expectedOutput: "thinkExpectedOutput",
            maxIterations: "thinkMaxIterations"
          },
          outputMap: { thoughtDecision: "decision" }
        }
      }
    },
    {
      id: "apply_decide",
      type: "transform",
      position: { x: 2180, y: 20 },
      data: {
        title: "Apply decision",
        reads: ["plan", "frontierId", "thoughtDecision"],
        inputs: {
          plan: { required: true, shape: JSON_SHAPE },
          frontierId: { required: true, shape: STRING },
          thoughtDecision: { required: true, shape: JSON_SHAPE }
        },
        writes: ["plan"],
        writeBindings: identityBindings(["plan"]),
        outputContracts: { plan: { required: true, shape: JSON_SHAPE } },
        auto: { assign: { plan: { op: "applyDecide" } } }
      }
    },
    {
      id: "halt",
      type: "transform",
      position: { x: 980, y: 320 },
      data: {
        title: "Halt",
        reads: ["plan", "targetTaskId"],
        inputs: {
          plan: { required: true, shape: JSON_SHAPE },
          targetTaskId: { required: false, shape: STRING }
        },
        writes: ["plan", "stop", "persistRoute", "planTitle", "planSummary", "planReason"],
        writeBindings: identityBindings([
          "plan",
          "stop",
          "persistRoute",
          "planTitle",
          "planSummary",
          "planReason"
        ]),
        outputContracts: {
          plan: { required: true, shape: JSON_SHAPE },
          stop: { required: true, shape: JSON_SHAPE },
          persistRoute: { required: true, shape: STRING },
          planTitle: { required: true, shape: STRING },
          planSummary: { required: true, shape: STRING },
          planReason: { required: true, shape: STRING }
        },
        auto: { assign: { plan: { op: "halt" } } }
      }
    },
    {
      id: "persist_branch",
      type: "switch",
      position: { x: 1220, y: 320 },
      data: {
        title: "Persist?",
        reads: ["persistRoute"],
        inputs: { persistRoute: { required: true, shape: STRING } },
        switch: { on: "persistRoute", cases: ["persist"], defaultLabel: "skip" }
      }
    },
    {
      id: "persist",
      type: "write",
      position: { x: 1460, y: 380 },
      data: {
        title: "Seal plan.v1",
        reads: ["planTitle", "planSummary", "planReason", "targetTaskId", "plan"],
        inputs: {
          planTitle: { required: true, shape: STRING },
          planSummary: { required: true, shape: STRING },
          planReason: { required: true, shape: STRING },
          targetTaskId: { required: true, shape: STRING },
          plan: { required: true, shape: JSON_SHAPE }
        },
        writes: ["planEntityId"],
        writeBindings: identityBindings(["planEntityId"]),
        outputContracts: { planEntityId: { required: true, shape: STRING } },
        write: {
          action: "create_entity",
          argsFromBag: {
            title: "planTitle",
            summary: "planSummary",
            reason: "planReason",
            linkFrom: "targetTaskId",
            document: "plan"
          },
          defaults: {
            type: "reference",
            status: "planned",
            resultAs: "planEntityId",
            kind: PLAN_V1_DOCUMENT_KIND,
            linkType: "references"
          }
        }
      }
    },
    { id: "end", type: "end", position: { x: 1700, y: 320 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_seed", source: "start", target: "seed", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_seed_pick", source: "seed", target: "pick", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_pick_haltq", source: "pick", target: "should_halt", kind: "next", sourcePin: "then", targetPin: "in" },
    {
      id: "e_haltq_classify",
      source: "should_halt",
      target: "classify",
      kind: "route",
      label: "classify",
      sourcePin: "classify",
      targetPin: "in"
    },
    {
      id: "e_haltq_halt",
      source: "should_halt",
      target: "halt",
      kind: "route",
      label: "halt",
      sourcePin: "halt",
      targetPin: "in"
    },
    { id: "e_classify_apply", source: "classify", target: "apply_classify", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_apply_status", source: "apply_classify", target: "status_branch", kind: "next", sourcePin: "then", targetPin: "in" },
    {
      id: "e_status_pick_atomic",
      source: "status_branch",
      target: "pick",
      kind: "route",
      label: "atomic",
      sourcePin: "atomic",
      targetPin: "in"
    },
    {
      id: "e_status_pick_dropped",
      source: "status_branch",
      target: "pick",
      kind: "route",
      label: "dropped",
      sourcePin: "dropped",
      targetPin: "in"
    },
    {
      id: "e_status_pick_question",
      source: "status_branch",
      target: "pick",
      kind: "route",
      label: "needs_question",
      sourcePin: "needs_question",
      targetPin: "in"
    },
    {
      id: "e_status_think",
      source: "status_branch",
      target: "prepare_think",
      kind: "route",
      label: "needs_decision",
      sourcePin: "needs_decision",
      targetPin: "in"
    },
    {
      id: "e_status_expand",
      source: "status_branch",
      target: "expand",
      kind: "route",
      label: "needs_subplan",
      sourcePin: "needs_subplan",
      targetPin: "in"
    },
    {
      id: "e_status_retry",
      source: "status_branch",
      target: "classify",
      kind: "route",
      label: "retry",
      sourcePin: "retry",
      targetPin: "in"
    },
    { id: "e_expand_apply", source: "expand", target: "apply_expand", kind: "next", sourcePin: "then", targetPin: "in" },
    {
      id: "e_apply_expand_branch",
      source: "apply_expand",
      target: "expand_branch",
      kind: "next",
      sourcePin: "then",
      targetPin: "in"
    },
    {
      id: "e_expand_ok_pick",
      source: "expand_branch",
      target: "pick",
      kind: "route",
      label: "ok",
      sourcePin: "ok",
      targetPin: "in"
    },
    {
      id: "e_expand_retry",
      source: "expand_branch",
      target: "expand",
      kind: "route",
      label: "retry",
      sourcePin: "retry",
      targetPin: "in"
    },
    { id: "e_prepare_think", source: "prepare_think", target: "think", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_think_apply", source: "think", target: "apply_decide", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_apply_decide_pick", source: "apply_decide", target: "pick", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_halt_persistq", source: "halt", target: "persist_branch", kind: "next", sourcePin: "then", targetPin: "in" },
    {
      id: "e_persistq_write",
      source: "persist_branch",
      target: "persist",
      kind: "route",
      label: "persist",
      sourcePin: "persist",
      targetPin: "in"
    },
    {
      id: "e_persistq_skip",
      source: "persist_branch",
      target: "end",
      kind: "route",
      label: "skip",
      sourcePin: "skip",
      targetPin: "in"
    },
    { id: "e_persist_end", source: "persist", target: "end", kind: "next", sourcePin: "then", targetPin: "in" }
  ]
};

