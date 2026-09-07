import { NextResponse } from "next/server";
import projects from "@projectplaner/db/projects";
import { withDb } from "../../../../lib/plan-api";

export async function PATCH(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    const body = await request.json();
    if (!body || typeof body.archived !== "boolean") return NextResponse.json({ error: "archived must be a boolean." }, { status: 400 });
    return await withDb(async (db) => NextResponse.json({ project: await projects.setArchived(db, key, body.archived) }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update Project.";
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
