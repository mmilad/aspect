import { describe, expect, it, vi } from "vitest";
import { WorkflowClient } from "../apps/agent/src/client/workflow-client";
import type { WorkflowRunResponse } from "../apps/agent/src/client/types";
import {
  CallableLlmAdapter,
  FixtureLlmAdapter,
  buildAdapterPrompt,
  loadFixtureFile,
  parseLlmWrites,
  resumePendingWithAdapter
} from "../apps/agent/src/llm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/agent/fixtures");

function pendingResponse(): WorkflowRunResponse {
  return {
    flow: { id: "flow_1", title: "Ensure aspect" },
    run: { id: "wrun_1", status: "pending_llm", workflowId: "flow_1" },
    step: {
      kind: "pending_llm",
      bag: {},
      nodeId: "decide",
      llm: {
        nodeId: "decide",
        instructions: "Choose createNew or reuse aspectId for Should host workflows",
        reads: { title: "Should host workflows" },
        outputSchema: ["aspectId", "createNew", "confidence"],
        tools: []
      }
    }
  };
}

describe("apps/agent pending_llm adapter", () => {
  it("builds slim adapter prompt around workflow instructions", () => {
    const prompt = buildAdapterPrompt({
      runId: "wrun_1",
      nodeId: "decide",
      instructions: "Pick an aspect.",
      reads: { title: "Demo" },
      outputSchema: ["aspectId", "createNew"],
      tools: []
    });
    expect(prompt).toContain("Pick an aspect.");
    expect(prompt).toContain("- aspectId");
    expect(prompt).toContain('"title": "Demo"');
  });

  it("parses llmWrites from model JSON (including fenced)", () => {
    const writes = parseLlmWrites(
      '```json\n{"aspectId":"a1","createNew":false,"confidence":0.8,"extra":1}\n```',
      ["aspectId", "createNew", "confidence"]
    );
    expect(writes).toEqual({ aspectId: "a1", createNew: false, confidence: 0.8 });
    expect(writes).not.toHaveProperty("extra");
  });

  it("fixture adapter returns writes without a live model", async () => {
    const adapter = new FixtureLlmAdapter({
      fixtures: [
        {
          workflowKey: "ensure_aspect",
          nodeId: "decide",
          llmWrites: { aspectId: "aspect_fixture", createNew: false, confidence: 0.91 }
        }
      ]
    });
    const writes = await adapter.complete({
      workflowKey: "ensure_aspect",
      pending: {
        runId: "wrun_1",
        nodeId: "decide",
        instructions: "x",
        reads: {},
        outputSchema: ["aspectId", "createNew", "confidence"],
        tools: []
      }
    });
    expect(writes.createNew).toBe(false);
    expect(writes.aspectId).toBe("aspect_fixture");
  });

  it("loads packaged ensure_aspect fixture file", async () => {
    const entries = await loadFixtureFile(path.join(fixturesDir, "ensure_aspect.decide.json"));
    expect(entries[0]?.nodeId).toBe("decide");
    expect(entries[0]?.llmWrites).toMatchObject({ createNew: false });
  });

  it("callable adapter maps model text to llmWrites", async () => {
    const adapter = new CallableLlmAdapter({
      completeText: async () => JSON.stringify({ aspectId: "aspect_x", createNew: true, confidence: 0.5 })
    });
    const writes = await adapter.complete({
      pending: {
        runId: "wrun_1",
        nodeId: "decide",
        instructions: "decide",
        reads: {},
        outputSchema: ["aspectId", "createNew", "confidence"],
        tools: []
      }
    });
    expect(writes).toEqual({ aspectId: "aspect_x", createNew: true, confidence: 0.5 });
  });

  it("resumePendingWithAdapter completes one pending_llm via fixture", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (body.llmWrites) {
        expect(body.llmWrites).toMatchObject({ aspectId: "aspect_fixture", createNew: false });
        return new Response(
          JSON.stringify({
            flow: { id: "flow_1" },
            run: { id: "wrun_1", status: "completed", workflowId: "flow_1" },
            step: { kind: "completed", bag: {}, nodeId: "end" }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error("unexpected");
    });

    const client = new WorkflowClient({
      apiBaseUrl: "http://planner.test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });
    const adapter = new FixtureLlmAdapter({
      fixtures: [
        {
          workflowKey: "ensure_aspect",
          nodeId: "decide",
          llmWrites: { aspectId: "aspect_fixture", createNew: false, confidence: 0.91 }
        }
      ]
    });

    const next = await resumePendingWithAdapter({
      client,
      adapter,
      response: pendingResponse(),
      workflowKey: "ensure_aspect"
    });
    expect(next.step.kind).toBe("completed");
  });
});
