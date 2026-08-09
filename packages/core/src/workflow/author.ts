import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "./schema";

export interface WorkflowAuthorBrief {
  /** What the user wants the workflow to accomplish. */
  brief: string;
  /** Optional title hint for the flow entity / start goal. */
  title?: string;
}

/** System rules for LLM turn 1: text outline only. */
export function buildWorkflowOutlineSystemPrompt(): string {
  return [
    "You draft a Projectplaner workflow as a short numbered list of steps.",
    "Output plain text only: numbered or bulleted pseudo-code steps.",
    "Cover control flow (branch/fork) in words when needed.",
    "Do NOT output JSON, markdown fences, or prose essays.",
    "Keep it compact (about 5–15 lines)."
  ].join(" ");
}

/** System rules for LLM turn 2: compile outline → graph JSON. */
export function buildWorkflowCompileSystemPrompt(): string {
  return [
    "You compile a text outline into Projectplaner Workflow Step Graph v2 JSON.",
    "Return ONLY valid JSON for { version: 2, nodes, edges } — no markdown fences, no prose.",
    "Control node types: start, end, error_end, branch, switch, fork, join, foreach, gate, wait, subworkflow.",
    "Work node types: tool, llm, context, transform, map, write.",
    "Exactly one start node and at least one end or error_end node.",
    "Each node needs id, type, position {x,y}, data.title.",
    "Each edge needs id, source, target, kind (next|route|depends_on|error), optional label.",
    "Declare reads[] and writes[] on nodes that touch the context bag.",
    "Prefer deterministic context/transform/map/tool/write; use llm only for judgment.",
    "LLM nodes must include data.llm.instructions and outputSchema matching writes.",
    "Lay nodes left-to-right with ~200px x spacing.",
    "Follow the provided outline; do not invent unrelated goals."
  ].join(" ");
}

/** @deprecated Prefer outline + compile prompts; kept for older callers. */
export function buildWorkflowAuthorSystemPrompt(): string {
  return buildWorkflowCompileSystemPrompt();
}

export function buildWorkflowOutlineUserPrompt(input: WorkflowAuthorBrief): string {
  const title = input.title?.trim();
  return [
    title ? `Workflow title: ${title}` : null,
    "User brief:",
    input.brief.trim(),
    "",
    "Produce a numbered pseudo-code outline of the workflow steps only."
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWorkflowCompileUserPrompt(input: WorkflowAuthorBrief & { outline: string }): string {
  const title = input.title?.trim();
  return [
    title ? `Workflow title: ${title}` : null,
    "Original brief:",
    input.brief.trim(),
    "",
    "Outline:",
    input.outline.trim(),
    "",
    "Compile the outline into a compact Workflow Step Graph v2 JSON object."
  ]
    .filter(Boolean)
    .join("\n");
}

/** @deprecated Prefer outline/compile user prompts. */
export function buildWorkflowAuthorUserPrompt(input: WorkflowAuthorBrief): string {
  return buildWorkflowCompileUserPrompt({ ...input, outline: "(no outline — invent from brief)" });
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

export type ChatCompletionMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmChatConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export function readLlmChatConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): LlmChatConfig | null {
  const baseUrl = env.PROJECTPLANER_LLM_BASE_URL?.replace(/\/$/, "");
  const model = env.PROJECTPLANER_LLM_MODEL;
  if (!baseUrl || !model) {
    return null;
  }
  return { baseUrl, model, apiKey: env.PROJECTPLANER_LLM_API_KEY };
}

/** OpenAI-compatible chat.completions helper (Ollama /v1, etc.). */
export async function chatCompletions(
  config: LlmChatConfig,
  messages: ChatCompletionMessage[],
  options?: { temperature?: number }
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: config.model,
      temperature: options?.temperature ?? 0.2,
      messages
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }
  return content;
}

/**
 * Turn 1 only: outline text from brief (no JSON compile).
 */
export async function generateWorkflowOutline(
  input: WorkflowAuthorBrief,
  config: LlmChatConfig
): Promise<string> {
  const outline = (
    await chatCompletions(config, [
      { role: "system", content: buildWorkflowOutlineSystemPrompt() },
      { role: "user", content: buildWorkflowOutlineUserPrompt(input) }
    ])
  ).trim();

  if (!outline) {
    throw new Error("Outline turn returned empty text.");
  }
  return outline;
}

/**
 * Two-turn author: outline text, then graph JSON.
 * Returns both intermediates for inspection.
 * When compile JSON fails schema checks, still returns outline + raw graphJson with `parseErrors`.
 */
export async function generateWorkflowTwoTurn(
  input: WorkflowAuthorBrief,
  config: LlmChatConfig
): Promise<{
  outline: string;
  graphJson: string;
  graph?: WorkflowGraph;
  parseErrors?: string[];
}> {
  const outline = await generateWorkflowOutline(input, config);

  const graphJson = await chatCompletions(config, [
    { role: "system", content: buildWorkflowCompileSystemPrompt() },
    { role: "user", content: buildWorkflowCompileUserPrompt({ ...input, outline }) }
  ]);

  const parsed = parseGeneratedWorkflowGraph(graphJson);
  if (!parsed.ok) {
    return { outline, graphJson, parseErrors: parsed.errors };
  }

  return { outline, graphJson, graph: parsed.graph };
}
