import { describe, expect, it } from "vitest";
import { exampleWorkflowGraph, newTaskWorkflowGraph } from "../../workflow";
import { compileWorkflow } from "./compile";
import { renderWorkflowPrompt } from "./prompt";

describe("compileWorkflow", () => {
  it("compiles example workflow into ordered function and llm steps", () => {
    const compiled = compileWorkflow(exampleWorkflowGraph, {
      goal: "Find the right Aspect",
      title: "Example"
    });

    expect(compiled.version).toBe(1);
    expect(compiled.goal).toBe("Find the right Aspect");
    expect(compiled.steps[0]).toEqual({ kind: "goal", text: "Find the right Aspect" });

    const kinds = compiled.steps.map((step) => step.kind);
    expect(kinds).toContain("function");
    expect(kinds).toContain("llm");
    expect(kinds).toContain("constraint");

    const load = compiled.steps.find(
      (step) => step.kind === "function" && step.name === "loadContext"
    );
    expect(load).toMatchObject({
      kind: "function",
      name: "loadContext",
      nodeId: "load"
    });

    const tool = compiled.steps.find(
      (step) => step.kind === "function" && step.name === "create_entity_if_missing"
    );
    expect(tool).toMatchObject({
      kind: "function",
      name: "create_entity_if_missing",
      params: {
        id: { $bag: "chosenAspectId" },
        title: { $bag: "createNewTitle" }
      }
    });

    const names = compiled.functions.map((fn) => fn.name);
    expect(names).toEqual(
      expect.arrayContaining(["loadContext", "filter", "create_entity_if_missing"])
    );
  });

  it("compiles new-task workflow with rank, branch, and assign helpers", () => {
    const compiled = compileWorkflow(newTaskWorkflowGraph, { goal: "Pick next task" });
    const names = compiled.steps
      .filter((step) => step.kind === "function")
      .map((step) => (step.kind === "function" ? step.name : ""));

    expect(names).toEqual(
      expect.arrayContaining([
        "loadContext",
        "rankTaskCandidates",
        "pickFirst",
        "neighborhoodOf",
        "composeTaskPrompt"
      ])
    );

    const branch = compiled.steps.find((step) => step.kind === "branch");
    expect(branch).toMatchObject({
      kind: "branch",
      condition: "!hasCandidates",
      nodeId: "gate"
    });
  });
});

describe("renderWorkflowPrompt", () => {
  it("renders a playbook with numbered function calls and appendix", () => {
    const prompt = renderWorkflowPrompt(exampleWorkflowGraph, {
      goal: "Find the right Aspect",
      title: "Example flow"
    });

    expect(prompt).toContain("Workflow: Example flow");
    expect(prompt).toContain("You need to: Find the right Aspect");
    expect(prompt).toContain("Call function `loadContext` with params");
    expect(prompt).toContain("Call function `filter` with params");
    expect(prompt).toContain("Pick the smallest truthful Aspect id from filteredEntities");
    expect(prompt).toContain("Call function `create_entity_if_missing` with params");
    expect(prompt).toContain("Available functions:");
    expect(prompt).toContain("`loadContext`");
    expect(prompt).toContain("Follow the steps in order");
  });

  it("accepts a precompiled workflow and optional bag reads", () => {
    const compiled = compileWorkflow(newTaskWorkflowGraph, { goal: "Next task" });
    const prompt = renderWorkflowPrompt(compiled, {
      bag: {
        workflowId: "wf",
        cursor: "llm",
        goal: "Next task",
        keys: {
          agentPrompt: "Do the task",
          selectedTask: { id: "task_1", title: "Demo" },
          secretFullGraph: "should-not-appear"
        }
      }
    });

    expect(prompt).toContain("You need to: Next task");
    expect(prompt).toContain("Call function `rankTaskCandidates`");
    expect(prompt).toContain("Context (declared LLM reads only):");
    expect(prompt).toContain("Do the task");
    expect(prompt).not.toContain("should-not-appear");
  });
});
