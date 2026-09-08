import { NextResponse } from "next/server";
import { getDatabaseController } from "@projectplaner/db";


import type { JsonRecord } from "@projectplaner/core";
import generator from "@projectplaner/core/generator";
import workflow from "@projectplaner/core/workflow";

const { scaffoldWorkflowFromBrief } = generator.author;
const { write: writeWorkflowGraph } = workflow.graph;


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
  const db = getDatabaseController();

  try {
    const created = await db.entities.create({
      projectKey: body.projectKey ?? "PLAN",
      type: "flow",
      title,
      summary: body.summary?.trim() || brief.slice(0, 160),
      body: brief,
      status: "planned",
      metadata: { schemaVersion: 3 },
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
    (await db.persist.saveGraph({
      workflowId: created.entity.id,
      projectId: created.entity.projectId,
      graph
    }));
    const metadata = writeWorkflowGraph((created.entity.metadata ?? {}) as JsonRecord, graph);
    const entity = await db.entities.update({
      id: created.entity.id,
      patch: { metadata }
    });

    // Ensure tables are preferred on next load.
    (await db.persist.getOrMigrateGraph({
      workflowId: entity.id,
      projectId: entity.projectId,
      metadata: entity.metadata as JsonRecord
    }));

    return NextResponse.json({ entity, warnings: created.warnings, graph });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create workflow flow." },
      { status: 400 }
    );
  }
}
