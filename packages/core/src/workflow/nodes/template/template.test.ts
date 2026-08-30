import { describe, expect, it } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { initFrameFromRunInputs, resolveDataInput, writeOutputPins } from "../../graph/frame";
import type { WorkflowContextBag } from "../../graph/types";
import { isPureDataNodeType, WORKFLOW_SCHEMA_VERSION } from "../../nodes";
import { runWorkflowUntilPause } from "../../runtime";

const STRING = { kind: "primitive" as const, type: "string" as const };

const templatePorts = {
  inputs: { name: { required: true, shape: STRING } },
  outputContracts: { text: { required: true, shape: STRING } }
};

describe("template node", () => {
  it("is a pure data node type", () => {
    expect(isPureDataNodeType("template")).toBe(true);
    expect(isPureDataNodeType("get")).toBe(true);
    expect(isPureDataNodeType("reroute")).toBe(true);
    expect(isPureDataNodeType("llm")).toBe(false);
  });

  it("parses data in and text out, and rejects exec edges", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [
        { name: "name", role: "input", shape: STRING, required: true },
        { name: "prompt", role: "output", shape: STRING, required: true }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "greet",
          type: "template",
          position: { x: 80, y: 80 },
          data: {
            title: "Greet",
            template: "Hello {{name}}",
            ...templatePorts
          }
        },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "d1", source: "start", target: "greet", kind: "data", sourcePin: "name", targetPin: "name" },
        { id: "d2", source: "greet", target: "end", kind: "data", sourcePin: "text", targetPin: "prompt" }
      ]
    });
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);

    const execInto = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [{ name: "name", role: "input", shape: STRING }],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "greet",
          type: "template",
          position: { x: 80, y: 0 },
          data: { title: "Greet", template: "Hello {{name}}", ...templatePorts }
        },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "greet", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "e2", source: "greet", target: "end", kind: "next", sourcePin: "then", targetPin: "in" }
      ]
    });
    expect(execInto.ok).toBe(false);
    if (!execInto.ok) {
      expect(execInto.errors.some((error) => /template cannot be an exec target/i.test(error))).toBe(true);
    }
  });

  it("pull-renders into an LLM without an extra exec step", async () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [
        { name: "name", role: "input", shape: STRING, required: true },
        { name: "reply", role: "output", shape: STRING, required: true }
      ],
      nodes: [
        {
          id: "start",
          type: "start",
          position: { x: 0, y: 0 },
          data: {
            title: "Start",
            outputContracts: { name: { required: true, shape: STRING } }
          }
        },
        {
          id: "greet",
          type: "template",
          position: { x: 80, y: 80 },
          data: {
            title: "Greet",
            template: "Hello {{name}}",
            ...templatePorts
          }
        },
        {
          id: "draft",
          type: "llm",
          position: { x: 200, y: 0 },
          data: {
            title: "Draft",
            inputs: { prompt: { required: true, shape: STRING } },
            outputContracts: { reply: { required: true, shape: STRING } },
            llm: { format: "text", instructions: "{{prompt}}", outputSchema: ["reply"] }
          }
        },
        { id: "end", type: "end", position: { x: 360, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "draft", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "e2", source: "draft", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "d1", source: "start", target: "greet", kind: "data", sourcePin: "name", targetPin: "name" },
        { id: "d2", source: "greet", target: "draft", kind: "data", sourcePin: "text", targetPin: "prompt" }
      ]
    });
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const bag = createContextBag({
      workflowId: "flow_template",
      goal: "greet",
      startNodeId: "start",
      keys: { name: "Ada" }
    });
    const paused = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    expect(paused.kind).toBe("pending_llm");
    expect(paused.nodeId).toBe("draft");
    expect(paused.llm?.reads.prompt).toBe("Hello Ada");
    expect(paused.llm?.instructions).toContain("Hello Ada");
  });

  it("nests chunk templates into a compose template", async () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [
        { name: "x", role: "input", shape: STRING, required: true },
        { name: "y", role: "input", shape: STRING, required: true },
        { name: "reply", role: "output", shape: STRING, required: true }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "chunkA",
          type: "template",
          position: { x: 80, y: 40 },
          data: {
            title: "A",
            template: "A: {{x}}",
            inputs: { x: { required: true, shape: STRING } },
            outputContracts: { text: { required: true, shape: STRING } }
          }
        },
        {
          id: "chunkB",
          type: "template",
          position: { x: 80, y: 120 },
          data: {
            title: "B",
            template: "B: {{y}}",
            inputs: { y: { required: true, shape: STRING } },
            outputContracts: { text: { required: true, shape: STRING } }
          }
        },
        {
          id: "compose",
          type: "template",
          position: { x: 160, y: 80 },
          data: {
            title: "Compose",
            template: "{{textA}}\n{{textB}}",
            inputs: {
              textA: { required: true, shape: STRING },
              textB: { required: true, shape: STRING }
            },
            outputContracts: { text: { required: true, shape: STRING } }
          }
        },
        {
          id: "draft",
          type: "llm",
          position: { x: 280, y: 0 },
          data: {
            title: "Draft",
            inputs: { prompt: { required: true, shape: STRING } },
            outputContracts: { reply: { required: true, shape: STRING } },
            llm: { format: "text", instructions: "{{prompt}}", outputSchema: ["reply"] }
          }
        },
        { id: "end", type: "end", position: { x: 400, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "draft", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "e2", source: "draft", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "d1", source: "start", target: "chunkA", kind: "data", sourcePin: "x", targetPin: "x" },
        { id: "d2", source: "start", target: "chunkB", kind: "data", sourcePin: "y", targetPin: "y" },
        { id: "d3", source: "chunkA", target: "compose", kind: "data", sourcePin: "text", targetPin: "textA" },
        { id: "d4", source: "chunkB", target: "compose", kind: "data", sourcePin: "text", targetPin: "textB" },
        { id: "d5", source: "compose", target: "draft", kind: "data", sourcePin: "text", targetPin: "prompt" }
      ]
    });
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const bag = createContextBag({
      workflowId: "flow_compose",
      goal: "compose",
      startNodeId: "start",
      keys: { x: "one", y: "two" }
    });
    const paused = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    expect(paused.kind).toBe("pending_llm");
    expect(paused.llm?.reads.prompt).toBe("A: one\nB: two");
  });

  it("renders (empty) for a missing wired input", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [
        { name: "name", role: "input", shape: STRING, required: true },
        { name: "prompt", role: "output", shape: STRING, required: true }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "greet",
          type: "template",
          position: { x: 80, y: 80 },
          data: {
            title: "Greet",
            template: "Topics: {{topics}}",
            inputs: { topics: { required: false, shape: STRING } },
            outputContracts: { text: { required: true, shape: STRING } }
          }
        },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "d1", source: "greet", target: "end", kind: "data", sourcePin: "text", targetPin: "prompt" }
      ]
    });
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const graph = parsed.graph;
    const bag: WorkflowContextBag = {
      workflowId: "wf",
      cursor: "start",
      goal: "test",
      keys: { name: "Ada" },
      status: "running"
    };
    bag.frame = initFrameFromRunInputs(graph, bag);
    const written = writeOutputPins(graph, bag, graph.nodes[0]!, { name: "Ada" });
    const end = graph.nodes.find((node) => node.type === "end")!;
    expect(resolveDataInput(graph, written, end, "prompt")).toBe("Topics: (empty)");
  });
});
