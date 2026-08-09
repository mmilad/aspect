import type {
  ResumeWorkflowInput,
  StartWorkflowInput,
  WorkflowRunResponse
} from "./types";
import { toPendingLlmSurface } from "./pending-llm";

export type WorkflowClientOptions = {
  apiBaseUrl: string;
  projectKey?: string;
  fetchImpl?: typeof fetch;
};

export class WorkflowClientError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "WorkflowClientError";
    this.status = status;
    this.body = body;
  }
}

export class WorkflowClient {
  readonly apiBaseUrl: string;
  readonly projectKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WorkflowClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.projectKey = options.projectKey ?? "PLAN";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Start a workflow by preset key or flow id. */
  async start(input: StartWorkflowInput): Promise<WorkflowRunResponse> {
    if (!input.key?.trim() && !input.id?.trim()) {
      throw new Error("start() requires key (preset) or id (flow entity id).");
    }
    return this.postRun({
      key: input.key,
      id: input.id,
      projectKey: input.projectKey ?? this.projectKey,
      goal: input.goal,
      bag: input.bag
    });
  }

  /** Resume a paused run (llmWrites and/or userRoute). */
  async resume(input: ResumeWorkflowInput): Promise<WorkflowRunResponse> {
    if (!input.runId.trim()) {
      throw new Error("resume() requires runId.");
    }
    if (!input.llmWrites && !input.userRoute) {
      throw new Error("resume() requires llmWrites or userRoute.");
    }
    return this.postRun({
      runId: input.runId,
      llmWrites: input.llmWrites,
      userRoute: input.userRoute,
      projectKey: input.projectKey ?? this.projectKey
    });
  }

  /** Poll an existing run without advancing (no llmWrites/userRoute). */
  async getRun(runId: string, projectKey?: string): Promise<WorkflowRunResponse> {
    if (!runId.trim()) {
      throw new Error("getRun() requires runId.");
    }
    return this.postRun({
      runId,
      projectKey: projectKey ?? this.projectKey
    });
  }

  /** Convenience: start/resume result → pending_llm surface or null. */
  pendingLlm(response: WorkflowRunResponse) {
    return toPendingLlmSurface(response);
  }

  private async postRun(body: Record<string, unknown>): Promise<WorkflowRunResponse> {
    const url = `${this.apiBaseUrl}/api/workflows/run`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new WorkflowClientError(
        `Could not reach Projectplaner API at ${url}: ${error instanceof Error ? error.message : String(error)}`,
        0,
        null
      );
    }

    const payload = (await response.json().catch(() => null)) as WorkflowRunResponse | { error?: string } | null;
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Workflow request failed (${response.status})`;
      throw new WorkflowClientError(message, response.status, payload);
    }
    if (!payload || typeof payload !== "object" || !("run" in payload) || !("step" in payload)) {
      throw new WorkflowClientError("Malformed workflow response.", response.status, payload);
    }
    return payload as WorkflowRunResponse;
  }
}
