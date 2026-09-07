import { NextResponse } from "next/server";
import projects, { type CreateProjectInput } from "@projectplaner/db/projects";
import { withDb } from "../../../lib/plan-api";

export async function GET(request: Request) {
  return withDb(async (db) => {
    const listed = await projects.list(db, { includeArchived: new URL(request.url).searchParams.get("includeArchived") === "true" });
    return NextResponse.json({ projects: listed });
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateProjectInput;

  try {
    return await withDb(async (db) => {
      const result = await projects.create(db, body);
      return NextResponse.json(result, { status: 201 });
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create project." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key?.trim()) {
    return NextResponse.json({ error: "Query param key is required." }, { status: 400 });
  }

  try {
    return await withDb(async (db) => {
      const result = await projects.remove(db, key);
      return NextResponse.json(result);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete project.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
