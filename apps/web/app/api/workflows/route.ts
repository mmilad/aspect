import path from "node:path";
import { NextResponse } from "next/server";
import {
  openDatabase,
  createEntity,
  getOrMigrateWorkflowGraph,
  saveWorkflowGraph,
  updateEntity
} from "@projectplaner/db";
import {
  scaffoldWorkflowFromBrief,
  writeWorkflowGraph,
  type JsonRecord
} from "@projectplaner/core";

async function openDb() {
  return openDatabase(process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db"));
}

interface CreateFlowBody {
  projectKey?: string;
  title?: string;
  brief?: string;
  summary?: string;
  /** Aspect/feature to relate the new flow to (supports). */
  targetEntityId?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateFlowBody;
  const title = body.title?.trim() || body.brief?.trim().slice(0, 80) || "New workflow";
  const brief = body.brief?.trim() || title;
  const db = await openDb();

  try {
    const created = await createEntity(db, {
      projectKey: body.projectKey ?? "PLAN",
      type: "flow",
      title,
      summary: body.summary?.trim() || brief.slice(0, 160),
      body: brief,
      status: "planned",
      metadata: { schemaVersion: 2 },
      ...(body.targetEntityId
        ? {
            relations: [
              {
                targetEntityId: body.targetEntityId,
                type: "supports" as const
              }
            ]
          }
        : {})
    });

    const graph = scaffoldWorkflowFromBrief({ brief, title });
    saveWorkflowGraph(db, {
      workflowId: created.entity.id,
      projectId: created.entity.projectId,
      graph
    });
    const metadata = writeWorkflowGraph((created.entity.metadata ?? {}) as JsonRecord, graph);
    const entity = await updateEntity(db, {
      id: created.entity.id,
      patch: { metadata }
    });

    // Ensure tables are preferred on next load.
    getOrMigrateWorkflowGraph(db, {
      workflowId: entity.id,
      projectId: entity.projectId,
      metadata: entity.metadata as JsonRecord
    });

    return NextResponse.json({ entity, warnings: created.warnings, graph });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create workflow flow." },
      { status: 400 }
    );
  } finally {
    db.close();
  }
}
