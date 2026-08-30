import type { WorkflowPreset } from "../types";
import { assistantTurnGraph } from "./graph";

export const assistantTurnPreset: WorkflowPreset = {
  presetKey: "assistant_turn",
  presetVersion: 3,
  title: "Assistant turn",
  summary:
    "Session standing snapshot, then last-N message window, then Turn A context pack and Turn B text reply.",
  body: [
    "Inputs: session (AssistantSession), message (string), optional windowSize (default 5, min 1).",
    "Step 1 assistant_session writes priorSummary, priorTopics, priorQuestions, priorContext.",
    "Step 2 assistant_window writes recentTurns = session.messages.slice(-windowSize).",
    "Turn A (llm_context) writes contextPack (assistant_context_v2): summary, ordered topics (active|parked, weight 0–1), questions (open|answered), context.",
    "Turn B (llm_reply) writes reply as plain text from contextPack + message only.",
    "A decision node can later sit between A and B; v1 wires A → B.",
    "End returns reply and contextPack. /api/assistant/turn drains this preset and merges the pack into the session document.",
    "Refresh seeded DB with: pnpm plan presets-ensure --force"
  ].join("\n"),
  status: "accepted",
  kind: "user",
  drainLlm: true,
  graph: assistantTurnGraph
};
