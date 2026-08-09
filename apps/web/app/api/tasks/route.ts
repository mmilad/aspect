import { NextResponse } from "next/server";
import { createTask } from "@projectplaner/db";
import { withDb } from "../../../lib/plan-api";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectKey?: string;
    title?: string;
    description?: string;
    status?: "in_planning" | "planned" | "in_progress" | "done" | "canceled" | "archived";
    priority?: "low" | "medium" | "high" | "critical";
    acceptanceCriteria?: string[];
    targetType?: "aspect" | "feature";
    targetId?: string;
    linkType?: "affects" | "implements" | "validates" | "investigates";
  };

  if (!body.projectKey || !body.title || !body.targetType || !body.targetId) {
    return NextResponse.json({ error: "projectKey, title, targetType and targetId are required." }, { status: 400 });
  }

  try {
    return await withDb(async (db) => {
      const task = await createTask(db, {
        projectKey: body.projectKey!,
        title: body.title!,
        description: body.description ?? "",
        status: body.status,
        priority: body.priority ?? "medium",
        acceptanceCriteria: body.acceptanceCriteria ?? [],
        targetType: body.targetType!,
        targetId: body.targetId!,
        linkType: body.linkType ?? "affects"
      });
      return NextResponse.json({ task });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create task." }, { status: 400 });
  }
}
