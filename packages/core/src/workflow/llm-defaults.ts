/** Applied at runtime when an LLM node omits or blanks `systemPrompt`. */
export const DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT =
  "You are a careful assistant in Projectplaner. Complete the given task using only the declared reads and output schema. Do not invent entity ids. Prefer compact, valid answers.";

/** Resolve node system prompt or the shared default. */
export function resolveWorkflowLlmSystemPrompt(systemPrompt: string | undefined): string {
  const trimmed = systemPrompt?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT;
}
