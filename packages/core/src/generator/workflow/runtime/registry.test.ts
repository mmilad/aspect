import { describe, expect, it } from "vitest";
import { adaptersFromRegistry, createFunctionRegistry } from "./adapters";
import { stepWorkflow } from "./step";
import { createContextBag, parseWorkflowGraph } from "../../../workflow";

describe("FunctionRegistry", () => {
  it("routes tool nodes through registry when runTool is omitted", async () => {
    const parsed = parseWorkflowGraph({
      version: 1,
      edges: [
        { id: "e1", source: "start", target: "tool" },
        { id: "e2", source: "tool", target: "end" }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["goal"] } },
        {
          id: "tool",
          type: "tool",
          position: { x: 100, y: 0 },
          data: {
            title: "Echo",
            reads: ["goal"],
            writes: ["out"],
            tool: { name: "echo", argsFromBag: { text: "goal" } }
          }
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const registry = createFunctionRegistry({
      echo: (args) => ({ values: { out: `echo:${String(args.text)}` } })
    });
    const adapters = adaptersFromRegistry(registry);
    const bag = createContextBag({
      workflowId: "wf",
      goal: "hello",
      startNodeId: "start"
    });

    let current = bag;
    let last = await stepWorkflow({ graph: parsed.graph, bag: current, adapters });
    current = last.bag;
    last = await stepWorkflow({ graph: parsed.graph, bag: current, adapters });
    current = last.bag;
    last = await stepWorkflow({ graph: parsed.graph, bag: current, adapters });

    expect(last.kind).toBe("completed");
    expect(current.keys.out).toBe("echo:hello");
  });
});
