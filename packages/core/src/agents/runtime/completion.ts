import type { AgentDecision } from "../types";

/** Persist only the final answer. Provider reasoning fields are never copied. */
export function parseAgentCompletion(text: string): AgentDecision {
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error("Agent returned invalid JSON."); }
  if (value?.type !== "complete" || typeof value.result !== "string" || !value.result.trim()) {
    throw new Error("Agent completed without a valid result.");
  }
  if (/<\/?(?:think|analysis|reasoning)\b/i.test(value.result)) {
    throw new Error("Agent returned reasoning markup instead of a final answer.");
  }
  return { type: "complete", result: value.result.trim() };
}
