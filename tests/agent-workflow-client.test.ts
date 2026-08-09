import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../apps/agent/src/config";
import { isPendingLlm, toPendingLlmSurface } from "../apps/agent/src/client/pending-llm";
import { WorkflowClient, WorkflowClientError } from "../apps/agent/src/client/workflow-client";
import type { WorkflowRunResponse } from "../apps/agent/src/client/types";

function samplePending(): WorkflowRunResponse {
  return {
    flow: { id: "flow_1", title: "Ensure aspect" },
    run: { id: "wrun_1", status: "pending_llm", workflowId: "flow_1" },
    step: {
      kind: "pending_llm",
      bag: { title: "Demo", status: "pending_llm" },
      nodeId: "llm_propose",
      llm: {
        nodeId: "llm_propose",
        instructions: "Propose a title for {{title}}",
        reads: { title: "Demo" },
        shapes: { title: "string" },
        outputSchema: ["summary"],
        tools: []
      }
    },
    note: "Paused for LLM."
  };
}

describe("apps/agent workflow client", () => {
  it("loads API base from PROJECTPLANER_API_URL or BASE_URL", () => {
    expect(loadConfig({ PROJECTPLANER_API_URL: "http://example.test/" }).apiBaseUrl).toBe("http://example.test");
    expect(loadConfig({ PROJECTPLANER_API_BASE_URL: "http://base.test" }).apiBaseUrl).toBe("http://base.test");
    expect(loadConfig({}).apiBaseUrl).toBe("http://127.0.0.1:3000");
  });

  it("surfaces pending_llm without dumping the bag", () => {
    const response = samplePending();
    expect(isPendingLlm(response)).toBe(true);
    const surface = toPendingLlmSurface(response);
    expect(surface).toEqual({
      runId: "wrun_1",
      nodeId: "llm_propose",
      instructions: "Propose a title for {{title}}",
      reads: { title: "Demo" },
      shapes: { title: "string" },
      outputSchema: ["summary"],
      tools: [],
      warnings: undefined
    });
    expect(JSON.stringify(surface)).not.toContain("status");
  });

  it("starts and resumes via /api/workflows/run", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (body.runId && body.llmWrites) {
        return new Response(
          JSON.stringify({
            flow: { id: "flow_1" },
            run: { id: "wrun_1", status: "completed", workflowId: "flow_1" },
            step: { kind: "completed", bag: {}, nodeId: "end" }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(samplePending()), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const client = new WorkflowClient({
      apiBaseUrl: "http://planner.test",
      projectKey: "PLAN",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const started = await client.start({ key: "ensure_aspect", bag: { title: "Demo" } });
    expect(started.run.id).toBe("wrun_1");
    expect(client.pendingLlm(started)?.instructions).toContain("Propose");

    const resumed = await client.resume({
      runId: "wrun_1",
      llmWrites: { summary: "ok" }
    });
    expect(resumed.step.kind).toBe("completed");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body));
    expect(firstBody).toMatchObject({ key: "ensure_aspect", projectKey: "PLAN" });
  });

  it("throws readable errors on HTTP failure", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Workflow flow not found for key 'nope'." }), {
        status: 404,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new WorkflowClient({
      apiBaseUrl: "http://planner.test",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await expect(client.start({ key: "nope" })).rejects.toBeInstanceOf(WorkflowClientError);
    await expect(client.start({ key: "nope" })).rejects.toThrow(/not found/i);
  });
});
