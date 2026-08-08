import { parseWorkflowGraph, type WorkflowGraph } from "./schema";

export interface WorkflowAuthorBrief {
  /** What the user wants the workflow to accomplish. */
  brief: string;
  /** Optional title hint for the flow entity / start goal. */
  title?: string;
}

export function buildWorkflowAuthorSystemPrompt(): string {
  return [
    "You author Projectplaner Workflow Step Graph v1 JSON.",
    "Return ONLY valid JSON for { version, nodes, edges } — no markdown fences, no prose.",
    "Node types allowed: start, context, filter, tool, llm, write, gate, end.",
    "Exactly one start node and at least one end node.",
    "Each node needs id, type, position {x,y}, data.title.",
    "Declare reads[] and writes[] on nodes that touch the per-task context bag.",
    "Prefer deterministic context/filter/tool/write/gate nodes; use llm only for judgment.",
    "LLM nodes must include data.llm.instructions and outputSchema matching writes.",
    "Tool nodes must include data.tool.name and argsFromBag when needed.",
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
    "Produce a compact Workflow Step Graph v1 that accomplishes this brief."
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
    version: 1,
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
      { id: "e1", source: "start", target: "load" },
      { id: "e2", source: "load", target: "decide" },
      { id: "e3", source: "decide", target: "end" }
    ]
  };
}
