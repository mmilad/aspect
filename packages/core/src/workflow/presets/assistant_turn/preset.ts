import type { WorkflowPreset } from "../types";
import { assistantTurnGraph } from "./graph";

export const assistantTurnPreset: WorkflowPreset = {
  presetKey: "assistant_turn",
  presetVersion: 8,
  title: "Assistant turn",
  summary:
    "Visible Assistant loop: session read, durable context pack, structured route, read-only retrieval or specialist delegation, grounded reply, and persistence.",
  body: [
    "Inputs: session (AssistantSession), message (string), optional windowSize (default 5, min 1).",
    "assistant_session writes priorSummary, priorTopics, priorQuestions, priorContext, allTurns, and recentTurns = session.messages.slice(-windowSize).",
    "Every turn performs the bounded read-only list_agents lookup so the Assistant always knows the active registered specialists.",
    "Turn A (llm_context) writes contextPack (assistant_context_v2): summary, ordered topics (active|parked, weight 0–1), questions (open|answered), context.",
    "The decision node uses the versioned Assistant role manifest and chooses reply, clarify, retrieve, delegate, or resume. Retrieval is bounded and uses only read-only Query nodes.",
    "The delegate node is the only Assistant path to a specialist and never writes the project itself.",
    "End returns reply, contextPack, and optional pending delegation. /api/assistant/turn drains this preset and merges the pack into the session document.",
    "Refresh seeded DB with: pnpm plan presets-ensure --force"
  ].join("\n"),
  status: "accepted",
  kind: "user",
  drainLlm: true,
  graph: assistantTurnGraph
};
