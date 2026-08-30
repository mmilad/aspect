import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT,
  resolveWorkflowLlmSystemPrompt
} from "./llm-defaults";

describe("workflow llm system prompt defaults", () => {
  it("uses shared default when missing or blank", () => {
    expect(resolveWorkflowLlmSystemPrompt(undefined)).toBe(DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT);
    expect(resolveWorkflowLlmSystemPrompt("")).toBe(DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT);
    expect(resolveWorkflowLlmSystemPrompt("   ")).toBe(DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT);
  });

  it("keeps custom system prompts", () => {
    expect(resolveWorkflowLlmSystemPrompt("Custom role.")).toBe("Custom role.");
  });
});
