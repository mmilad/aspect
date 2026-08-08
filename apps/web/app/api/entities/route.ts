import { NextResponse } from "next/server";
import type { CreateEntityInput, UpdateEntityInput } from "@projectplaner/db";
import { createEntity, updateEntity } from "@projectplaner/db";
import { createWebPlanApi, entityListWhere, withDb } from "../../../lib/plan-api";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return withDb(async (db) => {
    const api = createWebPlanApi(db);
    const result = await api.entities.list({
      projectKey: url.searchParams.get("projectKey") ?? "PLAN",
      where: entityListWhere({
        type: url.searchParams.get("type"),
        query: url.searchParams.get("query")
      }),
      // Preserve existing HTTP contract: full entities (UI writes/metadata expect body).
      select: "full"
    });
    return NextResponse.json({ entities: result.items });
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateEntityInput;

  try {
    return await withDb(async (db) => {
      const result = await createEntity(db, { ...body, projectKey: body.projectKey ?? "PLAN" });
      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create entity." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as UpdateEntityInput;

  try {
    return await withDb(async (db) => {
      return NextResponse.json({ entity: await updateEntity(db, body) });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update entity." }, { status: 400 });
  }
}
