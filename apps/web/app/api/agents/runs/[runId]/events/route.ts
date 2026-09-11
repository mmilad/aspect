import { getDatabaseController } from "@projectplaner/db";
import { replayCursor, replayResponse } from "../../../../../../lib/agent-event-replay";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const db = getDatabaseController();
  if (!await db.agentRuns.get(runId)) {
    return Response.json({ error: "Run not found." }, { status: 404 });
  }
  return replayResponse(await db.agentRuns.listEvents(runId, replayCursor(request)));
}
