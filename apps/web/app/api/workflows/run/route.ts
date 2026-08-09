import path from "node:path";
import { NextResponse } from "next/server";
import { openDatabase, runWorkflow } from "@projectplaner/db";

async function openDb() {
  return openDatabase(process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db"));
}

/**
 * General workflow runner.
 *
 * Start:
 *   { id: "flow_…" } or { key: "ensure_aspect" }
 *   optional: goal, bag, projectKey
 *
 * Resume / poll:
 *   { runId: "wrun_…" }
 *   optional: llmWrites, userRoute
 */
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
  };

  if (!body.runId && !body.id?.trim() && !body.key?.trim()) {
    return NextResponse.json(
      { error: "Provide id, key (presetKey / flow key), or runId." },
      { status: 400 }
    );
  }

  const db = await openDb();
  try {
    const result = await runWorkflow(db, {
      id: body.id,
      key: body.key,
      projectKey: body.projectKey,
      goal: body.goal,
      bag: body.bag,
      runId: body.runId,
      llmWrites: body.llmWrites,
      userRoute: body.userRoute
    });
    return NextResponse.json({
      flow: result.flow,
      run: result.run,
      step: result.step,
      nodeRuns: result.nodeRuns,
      note: result.note
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not run workflow.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  } finally {
    db.close();
  }
}
