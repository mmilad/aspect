import path from "node:path";
import { NextResponse } from "next/server";
import {
  openDatabase,
  createWorkflowRun,
  getEntity,
  getOrMigrateWorkflowGraph,
  getWorkflowRun,
  listWorkflowNodeRuns,
  listWorkflowTriggers,
  markWorkflowPresetDirty,
  saveWorkflowGraph,
  updateEntity
} from "@projectplaner/db";
import {
  createContextBag,
  findStartNode,
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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { action?: string; goal?: string; bag?: JsonRecord };
  if (body.action !== "run") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  const db = await openDb();
  try {
    const entity = await getEntity(db, id);
    if (!entity || entity.type !== "flow") {
      return NextResponse.json({ error: "Workflow flow not found." }, { status: 404 });
    }
    const graph =
      getOrMigrateWorkflowGraph(db, {
        workflowId: entity.id,
        projectId: entity.projectId,
        metadata: entity.metadata as JsonRecord
      }) ?? null;
    if (!graph) {
      return NextResponse.json({ error: "Workflow graph missing." }, { status: 400 });
    }
    const start = findStartNode(graph);
    if (!start) {
      return NextResponse.json({ error: "Workflow requires a start node." }, { status: 400 });
    }
    const goal = body.goal?.trim() || entity.title;
    const bag = createContextBag({
      workflowId: entity.id,
      goal,
      startNodeId: start.id,
      keys: body.bag
    });
    const run = createWorkflowRun(db, {
      workflowId: entity.id,
      projectId: entity.projectId,
      graph,
      bag: bag as unknown as JsonRecord
    });
    return NextResponse.json({
      run,
      nodeRuns: listWorkflowNodeRuns(db, run.id),
      note: "Run snapshot frozen. Minimal runner advances via step APIs; resume is not required yet."
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { runId?: string };
  if (!body.runId) {
    return NextResponse.json({ error: "runId required." }, { status: 400 });
  }
  const db = await openDb();
  try {
    const run = getWorkflowRun(db, body.runId);
    if (!run || run.workflowId !== id) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }
    return NextResponse.json({
      run,
      nodeRuns: listWorkflowNodeRuns(db, run.id)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load run." },
      { status: 400 }
    );
  } finally {
    db.close();
  }
}
