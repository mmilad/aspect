import path from "node:path";
import { NextResponse } from "next/server";
import {
  createDatabase,
  createRelation,
  listRelations,
  seedSelfPlanningProject,
  type CreateRelationInput
} from "@projectplaner/db";

function openDb() {
  return createDatabase(process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db"));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = openDb();

  try {
    await seedSelfPlanningProject(db);
    return NextResponse.json({
      relations: await listRelations(db, {
        projectKey: url.searchParams.get("projectKey") ?? "PLAN",
        sourceEntityId: url.searchParams.get("from") ?? undefined,
        targetEntityId: url.searchParams.get("to") ?? undefined,
        type: (url.searchParams.get("type") as CreateRelationInput["type"] | null) ?? undefined
      })
    });
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateRelationInput;
  const db = openDb();

  try {
    await seedSelfPlanningProject(db);
    return NextResponse.json({ relation: await createRelation(db, { ...body, projectKey: body.projectKey ?? "PLAN" }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create relation." }, { status: 400 });
  } finally {
    db.close();
  }
}
