import { NextResponse } from "next/server";
import { projectAssistantTrace } from "@projectplaner/core/assistant";
import type { WorkflowContextBag } from "@projectplaner/core";
import { withDb } from "../../../../../../lib/plan-api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const runId = new URL(request.url).searchParams.get("runId")?.trim();
  if (!runId) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  return withDb(async (db) => {
    const session = await db.assistantSessions.get(id);
    const run = await db.persist.getRun(runId);
    if (!session || !run) {
      return NextResponse.json({ error: "Assistant trace not found." }, { status: 404 });
    }

    const workflow = await db.entities.get(run.workflowId);
    if (workflow?.type !== "flow" || workflow.projectId !== session.projectId || workflow.metadata?.presetKey !== "assistant_turn") {
      return NextResponse.json({ error: "Assistant trace not found." }, { status: 404 });
    }

    const linkedMessage = session.session.messages.some(
      (message) => message.role === "assistant" && message.workflowRunId === runId
    );
    const bag = run.bag as unknown as WorkflowContextBag;
    const linkedSession = bag.keys?.assistantSessionId === id;
    if (!linkedMessage || !linkedSession) {
      return NextResponse.json({ error: "Assistant trace not found." }, { status: 404 });
    }

    return NextResponse.json({
      trace: projectAssistantTrace({
        id: run.id,
        status: run.status,
        definitionSnapshot: run.definitionSnapshot,
        bag,
        error: run.error,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt
      })
    });
  });
}
