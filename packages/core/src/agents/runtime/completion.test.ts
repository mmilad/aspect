import { describe, expect, it } from "vitest";
import { parseAgentCompletion } from "./completion";

describe("agent decision parser", () => {
  it.each([
    [{ type: "complete", result: "done" }, "complete"],
    [{ type: "clarification", question: "Which scope?" }, "clarification"],
    [{ type: "workflow", workflowId: "inspect", bag: {} }, "workflow"],
    [{ type: "capability", name: "project.list_agents", args: {} }, "capability"]
  ])("accepts %s", (value, type) => {
    expect(parseAgentCompletion(JSON.stringify(value)).type).toBe(type);
  });

  it("rejects malformed decisions", () => {
    expect(() => parseAgentCompletion(JSON.stringify({ type: "unknown" }))).toThrow("invalid decision");
    expect(() => parseAgentCompletion(JSON.stringify({ type: "workflow" }))).toThrow("invalid decision");
  });
});
