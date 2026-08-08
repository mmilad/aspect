import path from "node:path";
import { NextResponse } from "next/server";
import {
  createDatabase,
  createEntity,
  listEntities,
  updateEntity,
  type CreateEntityInput,
  type UpdateEntityInput
} from "@projectplaner/db";

function openDb() {
  return createDatabase(process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db"));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = openDb();

  try {
    return NextResponse.json({
      entities: await listEntities(db, {
        projectKey: url.searchParams.get("projectKey") ?? "PLAN",
        type: (url.searchParams.get("type") as CreateEntityInput["type"] | null) ?? undefined,
        query: url.searchParams.get("query") ?? undefined
      })
    });
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateEntityInput;
  const db = openDb();

  try {
    const result = await createEntity(db, { ...body, projectKey: body.projectKey ?? "PLAN" });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create entity." }, { status: 400 });
  } finally {
    db.close();
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as UpdateEntityInput;
  const db = openDb();

  try {
    return NextResponse.json({ entity: await updateEntity(db, body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update entity." }, { status: 400 });
  } finally {
    db.close();
  }
}
