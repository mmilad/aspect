import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "./schema";

export interface WorkflowAuthorBrief {
  /** What the user wants the workflow to accomplish. */
  brief: string;
  /** Optional title hint for the flow entity / start goal. */
  title?: string;
}

export function buildWorkflowAuthorSystemPrompt(): string {
  return [
    "You author Projectplaner Workflow Step Graph v2 JSON.",
    "Return ONLY valid JSON for { version: 2, nodes, edges } — no markdown fences, no prose.",
    "Control node types: start, end, error_end, branch, switch, fork, join, foreach, gate, wait, subworkflow.",
    "Work node types: tool, llm, context, transform, map, write.",
    "Exactly one start node and at least one end or error_end node.",
    "Each node needs id, type, position {x,y}, data.title.",
    "Each edge needs id, source, target, kind (next|route|depends_on|error), optional label.",
    "Declare reads[] and writes[] on nodes that touch the context bag.",
    "Prefer outputContracts with shape refs (Entity, EntityRelation, RankedTaskCandidate) when known.",
    "Use map nodes to project fields into new structures; foreach for per-item orchestration.",
    "Prefer deterministic context/transform/map/tool/write/gate nodes; use llm only for judgment.",
    "LLM nodes must include data.llm.instructions and outputSchema matching writes.",
    "LLM instructions may use bag templates: {{key}}, {{key.path}}, {{@reads}}, {{@shapes}} (filled at pending_llm from declared reads).",
    "Tool nodes must include data.tool.name and argsFromBag when needed.",
    "Use fork + depends_on into join for parallel arms; branch + route for if/else; switch + route (with default) for multi-way.",
    "foreach bodies should prefer type:subworkflow with workflowId.",
    "Never invent Aspect Graph entities; workflows are executable step diagrams.",
    "Lay nodes left-to-right with ~200px x spacing."
  ].join(" ");
}

export function buildWorkflowAuthorUserPrompt(input: WorkflowAuthorBrief): string {
  const title = input.title?.trim();
  return [
    title ? `Workflow title: ${title}` : null,
    "User brief:",
    input.brief.trim(),
    "",
    "Produce a compact Workflow Step Graph v2 that accomplishes this brief."
  ]
    .filter(Boolean)
    .join("\n");
}

/** Extract the first JSON object from an LLM response (allows accidental fences). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON object found in model response.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

export function parseGeneratedWorkflowGraph(text: string):
  | { ok: true; graph: WorkflowGraph }
  | { ok: false; errors: string[] } {
  try {
    const raw = extractJsonObject(text);
    return parseWorkflowGraph(raw);
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "Could not parse generated workflow JSON."]
    };
  }
}

/**
 * Deterministic scaffold when no LLM is configured.
 * Embeds the user brief as the primary llm.instructions so the intent is preserved.
 */
export function scaffoldWorkflowFromBrief(input: WorkflowAuthorBrief): WorkflowGraph {
  const brief = input.brief.trim() || "Describe the workflow goal.";
  const title = input.title?.trim() || "Generated workflow";

  return {
    version: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 0, y: 80 },
        data: { title: "Start", writes: ["goal"] }
      },
      {
        id: "load",
        type: "context",
        position: { x: 220, y: 80 },
        data: {
          title: "Load context",
          reads: ["goal"],
          writes: ["matches"],
          auto: {
            loadContext: {
              queryFrom: "goal",
              types: ["aspect", "feature", "task"],
              limit: 12
            }
          }
        }
      },
      {
        id: "decide",
        type: "llm",
        position: { x: 440, y: 80 },
        data: {
          title: title,
          reads: ["goal", "matches"],
          writes: ["plan", "confidence"],
          llm: {
            instructions: [
              "You are executing one step of a Projectplaner workflow.",
              "User intent:",
              brief,
              "",
              "Using goal and matches, produce a compact plan object and confidence 0-1.",
              "Do not invent graph topology; answer only the declared writes."
            ].join("\n"),
            inputKeys: ["goal", "matches"],
            outputSchema: ["plan", "confidence"],
            tools: []
          }
        }
      },
      {
        id: "end",
        type: "end",
        position: { x: 660, y: 80 },
        data: { title: "End" }
      }
    ],
    edges: [
      { id: "e1", source: "start", target: "load", kind: "next" },
      { id: "e2", source: "load", target: "decide", kind: "next" },
      { id: "e3", source: "decide", target: "end", kind: "next" }
    ]
  };
}
