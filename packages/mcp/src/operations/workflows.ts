import workflows from "@projectplaner/db/workflows";
import { DEFAULT_PROJECT_KEY, withDb } from "./session";

/** Start or resume a seeded workflow (by preset key or flow id). */
export async function runWorkflow(input: {
  id?: string;
  key?: string;
  goal?: string;
  bag?: Record<string, unknown>;
  runId?: string;
  llmWrites?: Record<string, unknown>;
  userRoute?: string;
  projectKey?: string;
}) {
  return withDb(async (db) => {
    const result = await workflows.run(db, {
      id: input.id,
      key: input.key,
      projectKey: input.projectKey ?? DEFAULT_PROJECT_KEY,
      goal: input.goal,
      bag: input.bag,
      runId: input.runId,
      llmWrites: input.llmWrites,
      userRoute: input.userRoute
    });
    return {
      flow: {
        id: result.flow.id,
        title: result.flow.title,
        presetKey: result.flow.metadata.presetKey ?? null
      },
      run: {
        id: result.run.id,
        status: result.run.status,
        workflowId: result.run.workflowId
      },
      step: {
        kind: result.step.kind,
        nodeId: result.step.nodeId,
        message: result.step.message,
        llm: result.step.llm,
        bagKeys: result.step.bag.keys
      },
      note: result.note
    };
  });
}
