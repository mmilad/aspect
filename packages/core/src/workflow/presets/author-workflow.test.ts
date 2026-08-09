import { describe, expect, it } from "vitest";
import { runWorkflowUntilPause, stepWorkflow } from "../../generator/workflow/runtime/step";
import { scaffoldWorkflowFromBrief } from "../author";
import { createContextBag, parseWorkflowGraph } from "../schema";
import { authorWorkflowGraph, authorWorkflowPreset } from "./author-workflow";

describe("author_workflow preset", () => {
  it("parses as v2 with outline then compile LLM nodes", () => {
    const parsed = parseWorkflowGraph(authorWorkflowGraph);
    expect(parsed.ok).toBe(true);
    expect(authorWorkflowPreset.presetKey).toBe("author_workflow");
    const llmIds = authorWorkflowGraph.nodes.filter((n) => n.type === "llm").map((n) => n.id);
    expect(llmIds).toEqual(["outline", "compile"]);
    expect(authorWorkflowGraph.nodes.find((n) => n.id === "outline")?.data.writes).toEqual([
      "outline"
    ]);
    expect(authorWorkflowGraph.nodes.find((n) => n.id === "compile")?.data.writes).toEqual([
      "graphJson"
    ]);
  });

  it("runs two pending_llm steps writing text then JSON string", async () => {
    const parsed = parseWorkflowGraph(authorWorkflowGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const bag = createContextBag({
      workflowId: "flow_author",
      goal: "author",
      startNodeId: "start",
      keys: {
        brief: "Search aspects then choose one with LLM",
        title: "Author demo",
        reason: "test"
      }
    });

    const first = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    expect(first.kind).toBe("pending_llm");
    expect(first.nodeId).toBe("outline");
    expect(first.llm?.outputSchema).toEqual(["outline"]);
    expect(first.llm?.outputs?.outline?.slim).toBe("string");
    expect(first.llm?.instructions).toContain("Search aspects then choose");

    const outlineText = "1. Start\n2. Load aspects\n3. LLM choose\n4. End";
    const afterOutline = await stepWorkflow({
      graph: parsed.graph,
      bag: first.bag,
      llmWrites: { outline: outlineText }
    });
    expect(afterOutline.kind).toBe("advanced");

    const second = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: afterOutline.bag
    });
    expect(second.kind).toBe("pending_llm");
    expect(second.nodeId).toBe("compile");
    expect(second.llm?.reads.outline).toBe(outlineText);
    expect(second.llm?.outputSchema).toEqual(["graphJson"]);

    const graphJson = JSON.stringify(
      scaffoldWorkflowFromBrief({ brief: "demo", title: "from outline" })
    );
    const afterCompile = await stepWorkflow({
      graph: parsed.graph,
      bag: second.bag,
      llmWrites: { graphJson }
    });
    expect(afterCompile.kind).toBe("advanced");
    expect(afterCompile.bag.keys.outline).toBe(outlineText);
    expect(afterCompile.bag.keys.graphJson).toBe(graphJson);

    const done = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: afterCompile.bag
    });
    expect(done.kind).toBe("completed");
  });

  it("rejects non-string outline write", async () => {
    const parsed = parseWorkflowGraph(authorWorkflowGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const bag = createContextBag({
      workflowId: "flow_author",
      goal: "author",
      startNodeId: "start",
      keys: { brief: "x", title: "y" }
    });
    const first = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    const bad = await stepWorkflow({
      graph: parsed.graph,
      bag: first.bag,
      llmWrites: { outline: 42 as unknown as string }
    });
    expect(bad.kind).toBe("failed");
    expect(bad.message).toMatch(/outline/);
  });
});
