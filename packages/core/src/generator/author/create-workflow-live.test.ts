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

  it("normalizes common local-model assistant route omissions without adding evidence", () => {
    const writes = llmWritesFromPending(
      pending({ schemaKey: "assistant_route_v1", outputSchema: ["decision"] }),
      'assistant_route_v1: {"route":"clarify","message":"Which project should I use?"}'
    );
    expect(writes).toEqual({
      decision: {
        route: "clarify",
        reason: "The model selected this route from the supplied context.",
        message: "Which project should I use?",
        question: "Which project should I use?"
      }
    });
  });

  it("normalizes unambiguous local-model route and lookup aliases", () => {
    const writes = llmWritesFromPending(
      pending({ schemaKey: "assistant_route_v1", outputSchema: ["decision"] }),
      '{"route":"query","reason":"Need the project agents","lookupKind":"list_agents"}'
    );
    expect(writes).toEqual({
      decision: {
        route: "retrieve",
        reason: "Need the project agents",
        lookupKind: "agents"
      }
    });
  });

  it("normalizes aliases inside a nested lookup object", () => {
    const writes = llmWritesFromPending(
      pending({ schemaKey: "assistant_route_v1", outputSchema: ["decision"] }),
      '{"route":"retrieve","reason":"Need the project agents","lookup":{"kind":"list_agents"}}'
    );
    expect(writes).toEqual({
      decision: {
        route: "retrieve",
        reason: "Need the project agents",
        lookup: { kind: "agents" },
        lookupKind: "agents"
      }
    });
  });
});
