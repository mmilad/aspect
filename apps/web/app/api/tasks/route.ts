import path from "node:path";
import { NextResponse } from "next/server";
import { createDatabase, createTask, seedSelfPlanningProject } from "@projectplaner/db";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectKey?: string;
    title?: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "critical";
    acceptanceCriteria?: string[];
    targetType?: "aspect" | "feature";
    targetId?: string;
    linkType?: "affects" | "implements" | "validates" | "investigates";
  };

  if (!body.projectKey || !body.title || !body.targetType || !body.targetId) {
    return NextResponse.json({ error: "projectKey, title, targetType and targetId are required." }, { status: 400 });
  }

  const dbPath = process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db");
  const db = createDatabase(dbPath);

  try {
    await seedSelfPlanningProject(db);
    const task = await createTask(db, {
      projectKey: body.projectKey,
      title: body.title,
      description: body.description ?? "",
      priority: body.priority ?? "medium",
      acceptanceCriteria: body.acceptanceCriteria ?? [],
      targetType: body.targetType,
      targetId: body.targetId,
      linkType: body.linkType ?? "affects"
    });

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create task." }, { status: 400 });
  } finally {
    db.close();
  }
}

