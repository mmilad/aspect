import { describe, expect, it, vi } from "vitest";
import { parseArgs } from "../apps/agent/src/cli";
import { WorkflowClient } from "../apps/agent/src/client/workflow-client";
import { FixtureLlmAdapter } from "../apps/agent/src/llm";
import { runWorkflowLoop } from "../apps/agent/src/run-loop";
import type { WorkflowRunResponse } from "../apps/agent/src/client/types";

function pending(): WorkflowRunResponse {
  return {
    flow: { id: "flow_1", title: "Ensure aspect" },
    run: { id: "wrun_1", status: "pending_llm", workflowId: "flow_1" },
    step: {
      kind: "pending_llm",
      bag: { title: "Demo" },
      nodeId: "decide",
      llm: {
        nodeId: "decide",
        instructions: "decide",
        reads: { title: "Demo" },
        outputSchema: ["aspectId", "createNew", "confidence"],
        tools: []
      }
    }
  };
}

describe("apps/agent run loop", () => {
  it("parses --fixtures and --llm-hook flags", () => {
    expect(parseArgs(["-w", "ensure_aspect", "--fixtures"]).fixtures).toBe(true);
    expect(parseArgs(["-w", "x", "--fixtures", "./fx"]).fixtures).toBe("./fx");
    expect(parseArgs(["-w", "x", "--llm-hook", "node hook.js"]).llmHook).toBe("node hook.js");
    expect(parseArgs(["-w", "x", "--max-llm-steps", "3"]).maxLlmSteps).toBe(3);
  });

  it("runs start → fixture resume → completed without a live model", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (body.key === "ensure_aspect") {
        return new Response(JSON.stringify(pending()), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (body.runId && body.llmWrites) {
        expect(body.llmWrites).toMatchObject({ aspectId: "aspect_fixture", createNew: false });
        return new Response(
          JSON.stringify({
            flow: { id: "flow_1", title: "Ensure aspect" },
            run: { id: "wrun_1", status: "completed", workflowId: "flow_1" },
            step: {
              kind: "completed",
              bag: { aspectId: "aspect_fixture", status: "completed" },
              nodeId: "end"
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`unexpected body ${JSON.stringify(body)}`);
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

    const result = await runWorkflowLoop({
      client,
      adapter,
      workflowKey: "ensure_aspect",
      start: { key: "ensure_aspect", bag: { title: "Demo" } }
    });

    expect(result.llmSteps).toBe(1);
    expect(result.response.step.kind).toBe("completed");
    expect(result.response.step.bag.aspectId).toBe("aspect_fixture");
    expect(result.history.map((item) => item.step)).toEqual(["pending_llm", "completed"]);
  });

  it("stops at pending_llm when no adapter is provided", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(pending()), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new WorkflowClient({
      apiBaseUrl: "http://planner.test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const result = await runWorkflowLoop({
      client,
      start: { key: "ensure_aspect" }
    });
    expect(result.llmSteps).toBe(0);
    expect(result.response.step.kind).toBe("pending_llm");
  });
});
