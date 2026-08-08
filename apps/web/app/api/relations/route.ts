import { NextResponse } from "next/server";
import {
  createRelation,
  listRelations,
  type CreateRelationInput
} from "@projectplaner/db";
import { withDb } from "../../../lib/plan-api";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return withDb(async (db) =>
    NextResponse.json({
      relations: await listRelations(db, {
        projectKey: url.searchParams.get("projectKey") ?? "PLAN",
        sourceEntityId: url.searchParams.get("from") ?? undefined,
        targetEntityId: url.searchParams.get("to") ?? undefined,
        type: (url.searchParams.get("type") as CreateRelationInput["type"] | null) ?? undefined
      })
    })
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateRelationInput;

  try {
    return await withDb(async (db) =>
      NextResponse.json({ relation: await createRelation(db, { ...body, projectKey: body.projectKey ?? "PLAN" }) })
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create relation." }, { status: 400 });
  }
}
