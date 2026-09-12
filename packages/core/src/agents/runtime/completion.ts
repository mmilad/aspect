import type { AgentDecision } from "../types";

/** Parse the public agent decision contract; provider reasoning is never copied. */
export function parseAgentCompletion(text: string): AgentDecision {
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error("Agent returned invalid JSON."); }
  if (value?.type === "complete") {
    if (typeof value.result !== "string" || !value.result.trim()) {
      throw new Error("Agent completed without a valid result.");
    }
    if (/<\/?(?:think|analysis|reasoning)\b/i.test(value.result)) {
      throw new Error("Agent returned reasoning markup instead of a final answer.");
    }
    return { type: "complete", result: value.result.trim() };
  }
  if (value?.type === "clarification" && typeof value.question === "string" && value.question.trim()) {
    return { type: "clarification", question: value.question.trim() };
  }
  if (value?.type === "workflow" && typeof value.workflowId === "string" && value.workflowId.trim()) {
    return { type: "workflow", workflowId: value.workflowId.trim(), ...(isRecord(value.bag) ? { bag: value.bag } : {}) };
  }
  if (value?.type === "capability" && typeof value.name === "string" && value.name.trim()) {
    return { type: "capability", name: value.name.trim(), ...(isRecord(value.args) ? { args: value.args } : {}) };
  }
  throw new Error("Agent returned an invalid decision.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
