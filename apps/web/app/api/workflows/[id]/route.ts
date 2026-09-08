import { NextResponse } from "next/server";
import { getDatabaseController} from "@projectplaner/db";


import type { JsonRecord, WorkflowGraph } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { parse: parseWorkflowGraph, write: writeWorkflowGraph } = workflow.graph;
import { drainPendingLlm, shouldDrainPendingLlm, workflowRunJson } from "../../../../lib/drain-pending-llm";


export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getDatabaseController();
  try {
    const entity = await db.entities.get(id);
    if (!entity || entity.type !== "flow") {
      return NextResponse.json({ error: "Workflow flow not found." }, { status: 404 });
    }
    const graph = (await db.persist.getOrMigrateGraph({
      workflowId: entity.id,
      projectId: entity.projectId,
      metadata: entity.metadata as JsonRecord
    }));
    const fallback = graph ? null : parseWorkflowGraph((entity.metadata as JsonRecord).graph);
    return NextResponse.json({
      entity,
      graph: graph ?? (fallback && fallback.ok ? fallback.graph : null),
      triggers: (await db.persist.listTriggers(entity.id))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load workflow." },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { graph?: WorkflowGraph };
  const db = getDatabaseController();
  try {
    const entity = await db.entities.get(id);
    if (!entity || entity.type !== "flow") {
      return NextResponse.json({ error: "Workflow flow not found." }, { status: 404 });
    }
    if (!body.graph) {
      return NextResponse.json({ error: "graph is required." }, { status: 400 });
    }
    const graph = (await db.persist.saveGraph({
      workflowId: entity.id,
      projectId: entity.projectId,
      graph: body.graph
    }));
    let metadata = writeWorkflowGraph((entity.metadata ?? {}) as JsonRecord, graph);
    if (typeof metadata.presetKey === "string") {
      metadata = { ...metadata, presetDirty: true };
    }
    const updated = await db.entities.update({ id: entity.id, patch: { metadata } });
    await db.presets.markDirty(entity.id);
    return NextResponse.json({ entity: updated, graph });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save workflow." },
      { status: 400 }
    );
  }
}

/** @deprecated Prefer POST /api/workflows/run with { id }. Kept as a thin alias. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    action?: string;
    goal?: string;
    bag?: JsonRecord;
    drainLlm?: boolean;
  };
  if (body.action !== "run") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  const db = getDatabaseController();
  try {
    const started = await db.workflows.run({
      id,
      goal: body.goal,
      bag: body.bag as Record<string, unknown> | undefined
    });
    const result = shouldDrainPendingLlm(body.drainLlm, started.flow.metadata?.presetKey)
      ? await drainPendingLlm(db, started)
      : { ...started, turns: [], llmConfigured: false };
    return NextResponse.json(workflowRunJson(result));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start workflow run." },
      { status: 400 }
    );
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
  const db = getDatabaseController();
  try {
    const result = await db.workflows.run({
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
  }
}
