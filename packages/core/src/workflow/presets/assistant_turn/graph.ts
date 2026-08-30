import { ASSISTANT_CONTEXT_V2_KEY } from "../../llm/llm-json-schemas";
import { WORKFLOW_SCHEMA_VERSION, type WorkflowNode } from "../../nodes";
import type { WorkflowEdge, WorkflowGraph } from "../../graph";

const STRING = { kind: "primitive" as const, type: "string" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };
const JSON_SHAPE = { kind: "any" as const };
const JSON_ARRAY = { kind: "array" as const, items: JSON_SHAPE };

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

const TURN_A_SYSTEM = [
  "You assemble the standing picture for this Projectplaner Assistant turn.",
  "Rewrite the full topic and question lists; do not append forever.",
  "Park topics instead of omitting them. Mark questions answered instead of omitting them.",
  "Never invent graph entity ids; only keep ids already in priorContext or named by the user.",
  "Return JSON matching assistant_context_v2."
].join(" ");

const TURN_A_INSTRUCTIONS = [
  "Prior summary: {{priorSummary}}",
  "Prior topics: {{priorTopics}}",
  "Prior questions: {{priorQuestions}}",
  "Prior context: {{priorContext}}",
  "Recent turns: {{recentTurns}}",
  "User message: {{message}}"
].join("\n");

const TURN_B_SYSTEM = [
  "Reply to the user for the Projectplaner Assistant pane.",
  "Use only the context pack. Do not re-summarize the archive.",
  "Plain text only."
].join(" ");

const TURN_B_INSTRUCTIONS = ["Context pack: {{contextPack}}", "User message: {{message}}"].join("\n");

/**
 * Session standing data first, then transcript window, then Turn A (JSON pack) → Turn B (text).
 * Decision between A and B is an insertion point, not seeded.
 */
export const assistantTurnGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "session", role: "input", shape: JSON_SHAPE, required: true },
    { name: "message", role: "input", shape: STRING, required: true },
    { name: "windowSize", role: "input", shape: NUMBER, required: false },
    { name: "contextPack", role: "output", shape: JSON_SHAPE, required: false },
    { name: "reply", role: "output", shape: STRING, required: true }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 200 },
      data: {
        title: "Start",
        outputContracts: {
          session: { required: true, shape: JSON_SHAPE },
          message: { required: true, shape: STRING },
          windowSize: { required: false, shape: NUMBER }
        }
      }
    },
    knot("r_session", 200, 280),
    knot("r_message", 200, 340),
    knot("r_pack", 1100, 280),
    {
      id: "session_read",
      type: "assistant_session",
      position: { x: 340, y: 200 },
      data: {
        title: "Session read",
        inputs: {
          session: { required: true, shape: JSON_SHAPE }
        },
        outputContracts: {
          priorSummary: { required: false, shape: JSON_SHAPE },
          priorTopics: { required: true, shape: JSON_ARRAY },
          priorQuestions: { required: true, shape: JSON_ARRAY },
          priorContext: { required: true, shape: JSON_SHAPE }
        }
      }
    },
    {
      id: "window",
      type: "assistant_window",
      position: { x: 620, y: 200 },
      data: {
        title: "Window",
        inputs: {
          session: { required: true, shape: JSON_SHAPE },
          windowSize: { required: false, shape: NUMBER }
        },
        outputContracts: {
          recentTurns: { required: true, shape: JSON_ARRAY }
        }
      }
    },
    {
      id: "llm_context",
      type: "llm",
      position: { x: 920, y: 200 },
      data: {
        title: "Turn A context pack",
        inputs: {
          priorSummary: { required: false, shape: JSON_SHAPE },
          priorTopics: { required: true, shape: JSON_ARRAY },
          priorQuestions: { required: true, shape: JSON_ARRAY },
          priorContext: { required: true, shape: JSON_SHAPE },
          recentTurns: { required: true, shape: JSON_ARRAY },
          message: { required: true, shape: STRING }
        },
        outputContracts: {
          contextPack: { required: true, shape: JSON_SHAPE }
        },
        llm: {
          schemaKey: ASSISTANT_CONTEXT_V2_KEY,
          outputSchema: ["contextPack"],
          systemPrompt: TURN_A_SYSTEM,
          instructions: TURN_A_INSTRUCTIONS
        }
      }
    },
    {
      id: "llm_reply",
      type: "llm",
      position: { x: 1240, y: 200 },
      data: {
        title: "Turn B reply",
        inputs: {
          contextPack: { required: true, shape: JSON_SHAPE },
          message: { required: true, shape: STRING }
        },
        outputContracts: {
          reply: { required: true, shape: STRING }
        },
        llm: {
          format: "text",
          outputSchema: ["reply"],
          systemPrompt: TURN_B_SYSTEM,
          instructions: TURN_B_INSTRUCTIONS
        }
      }
    },
    {
      id: "end",
      type: "end",
      position: { x: 1540, y: 200 },
      data: {
        title: "End",
        inputs: {
          reply: { required: true, shape: STRING },
          contextPack: { required: false, shape: JSON_SHAPE }
        }
      }
    }
  ],
  edges: [
    { id: "e1", source: "start", target: "session_read", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e2", source: "session_read", target: "window", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e3", source: "window", target: "llm_context", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e4", source: "llm_context", target: "llm_reply", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e5", source: "llm_reply", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
    data("d_start_r_session", "start", "session", "r_session", "value"),
    data("d_r_session_read", "r_session", "value", "session_read", "session"),
    data("d_r_session_window", "r_session", "value", "window", "session"),
    data("d_start_window_size", "start", "windowSize", "window", "windowSize"),
    data("d_start_r_message", "start", "message", "r_message", "value"),
    data("d_r_message_a", "r_message", "value", "llm_context", "message"),
    data("d_r_message_b", "r_message", "value", "llm_reply", "message"),
    data("d_prior_summary", "session_read", "priorSummary", "llm_context", "priorSummary"),
    data("d_prior_topics", "session_read", "priorTopics", "llm_context", "priorTopics"),
    data("d_prior_questions", "session_read", "priorQuestions", "llm_context", "priorQuestions"),
    data("d_prior_context", "session_read", "priorContext", "llm_context", "priorContext"),
    data("d_recent_turns", "window", "recentTurns", "llm_context", "recentTurns"),
    data("d_pack_r", "llm_context", "contextPack", "r_pack", "value"),
    data("d_r_pack_reply", "r_pack", "value", "llm_reply", "contextPack"),
    data("d_r_pack_end", "r_pack", "value", "end", "contextPack"),
    data("d_reply_end", "llm_reply", "reply", "end", "reply")
  ]
};
