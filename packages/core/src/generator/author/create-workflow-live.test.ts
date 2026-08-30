import { describe, expect, it } from "vitest";
import { llmWritesFromPending } from "./create-workflow-live";
import type { WorkflowLlmPending } from "../../workflow/runtime/types";

function pending(overrides: Partial<WorkflowLlmPending> = {}): WorkflowLlmPending {
  return {
    nodeId: "plan_steps",
    systemPrompt: "",
    instructions: "",
    reads: {},
    outputSchema: ["stepInstructionsList"],
    tools: [],
    format: "json_schema",
    ...overrides
  };
}

describe("llmWritesFromPending", () => {
  it("wraps a bare schema object when the single output key is missing", () => {
    const writes = llmWritesFromPending(
      pending({ outputSchema: ["nodePlan"] }),
      '{"nodeType":"math","title":"Halve","config":{}}'
    );
    expect(writes).toEqual({
      nodePlan: { nodeType: "math", title: "Halve", config: {} }
    });
  });

  it("maps a text reply onto the single output key", () => {
    const writes = llmWritesFromPending(
      pending({ format: "text", outputSchema: ["reply"] }),
      "Switching focus to the graph."
    );
    expect(writes).toEqual({ reply: "Switching focus to the graph." });
  });

  it("keeps listed keys when the model already wraps them", () => {
    const writes = llmWritesFromPending(
      pending(),
      '{"stepInstructionsList":["Title: A.","Title: B."],"extra":true}'
    );
    expect(writes).toEqual({
      stepInstructionsList: ["Title: A.", "Title: B."]
    });
  });
});
