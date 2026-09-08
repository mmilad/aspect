import { NextResponse } from "next/server";
import { getDatabaseController } from "@projectplaner/db";

import { drainPendingLlm, shouldDrainPendingLlm, workflowRunJson } from "../../../../lib/drain-pending-llm";


/**
 * General workflow runner.
 *
 * Start:
 *   { id: "flow_…" } or { key: "ensure_aspect" }
 *   optional: goal, bag, projectKey
 *
 * Resume / poll:
 *   POST { runId } with optional llmWrites / userRoute
 *   GET  ?runId=wrun_…  (snapshot; does not drain)
 */
export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId")?.trim();
  if (!runId) {
    return NextResponse.json({ error: "Provide runId." }, { status: 400 });
  }
  const db = getDatabaseController();
  try {
    const started = await db.workflows.run({ runId });
    return NextResponse.json(
      workflowRunJson({ ...started, turns: [], llmConfigured: false })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load workflow run.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    key?: string;
    projectKey?: string;
    goal?: string;
    bag?: Record<string, unknown>;
    runId?: string;
    llmWrites?: Record<string, unknown>;
    userRoute?: string;
    drainLlm?: boolean;
  };

  if (!body.runId && !body.id?.trim() && !body.key?.trim()) {
    return NextResponse.json(
      { error: "Provide id, key (presetKey / flow key), or runId." },
      { status: 400 }
    );
  }

  const db = getDatabaseController();
  try {
    const started = await db.workflows.run({
      id: body.id,
      key: body.key,
      projectKey: body.projectKey,
      goal: body.goal,
      bag: body.bag,
      runId: body.runId,
      llmWrites: body.llmWrites,
      userRoute: body.userRoute
    });
    const drain = shouldDrainPendingLlm(body.drainLlm, started.flow.metadata?.presetKey);
    const result = drain ? await drainPendingLlm(db, started) : { ...started, turns: [], llmConfigured: false };
    return NextResponse.json(workflowRunJson(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not run workflow.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
