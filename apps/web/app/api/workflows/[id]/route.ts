import path from "node:path";
import { NextResponse } from "next/server";
import {
  openDatabase,
  getEntity,
  getOrMigrateWorkflowGraph,
  listWorkflowTriggers,
  markWorkflowPresetDirty,
  runWorkflow,
  saveWorkflowGraph,
  updateEntity
} from "@projectplaner/db";
import {
  parseWorkflowGraph,
  writeWorkflowGraph,
  type JsonRecord,
  type WorkflowGraph
} from "@projectplaner/core";

async function openDb() {
  return openDatabase(process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db"));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await openDb();
  try {
    const entity = await getEntity(db, id);
    if (!entity || entity.type !== "flow") {
      return NextResponse.json({ error: "Workflow flow not found." }, { status: 404 });
    }
    const graph = getOrMigrateWorkflowGraph(db, {
      workflowId: entity.id,
      projectId: entity.projectId,
      metadata: entity.metadata as JsonRecord
    });
    const fallback = graph ? null : parseWorkflowGraph((entity.metadata as JsonRecord).graph);
    return NextResponse.json({
      entity,
      graph: graph ?? (fallback && fallback.ok ? fallback.graph : null),
      triggers: listWorkflowTriggers(db, entity.id)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load workflow." },
      { status: 400 }
    );
  } finally {
    db.close();
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { graph?: WorkflowGraph };
  const db = await openDb();
  try {
    const entity = await getEntity(db, id);
    if (!entity || entity.type !== "flow") {
      return NextResponse.json({ error: "Workflow flow not found." }, { status: 404 });
    }
    if (!body.graph) {
      return NextResponse.json({ error: "graph is required." }, { status: 400 });
    }
    const graph = saveWorkflowGraph(db, {
      workflowId: entity.id,
      projectId: entity.projectId,
      graph: body.graph
    });
    let metadata = writeWorkflowGraph((entity.metadata ?? {}) as JsonRecord, graph);
    if (typeof metadata.presetKey === "string") {
      metadata = { ...metadata, presetDirty: true };
    }
    const updated = await updateEntity(db, { id: entity.id, patch: { metadata } });
    await markWorkflowPresetDirty(db, entity.id);
    return NextResponse.json({ entity: updated, graph });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save workflow." },
      { status: 400 }
    );
  } finally {
    db.close();
  }
}

/** @deprecated Prefer POST /api/workflows/run with { id }. Kept as a thin alias. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { action?: string; goal?: string; bag?: JsonRecord };
  if (body.action !== "run") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  const db = await openDb();
  try {
    const result = await runWorkflow(db, {
      id,
      goal: body.goal,
      bag: body.bag as Record<string, unknown> | undefined
    });
    return NextResponse.json({
      run: result.run,
      step: result.step,
      nodeRuns: result.nodeRuns,
      note: result.note
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start workflow run." },
      { status: 400 }
    );
  } finally {
    db.close();
  }
}

/** @deprecated Prefer POST /api/workflows/run with { runId, llmWrites }. Kept as a thin alias. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    runId?: string;
    llmWrites?: Record<string, unknown>;
    userRoute?: string;
  };
  if (!body.runId) {
    return NextResponse.json({ error: "runId required." }, { status: 400 });
  }
  const db = await openDb();
  try {
    const result = await runWorkflow(db, {
      id,
      runId: body.runId,
      llmWrites: body.llmWrites,
      userRoute: body.userRoute
    });
    return NextResponse.json({
      run: result.run,
      step: result.step,
      nodeRuns: result.nodeRuns,
      note: result.note
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not advance workflow run." },
      { status: 400 }
    );
  } finally {
    db.close();
  }
}
