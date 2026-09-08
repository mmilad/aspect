import { NextResponse } from "next/server";

import { withDb } from "../../../../lib/plan-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectKey = url.searchParams.get("projectKey") ?? "PLAN";
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  return withDb(async (db) => {
    const sessions = (await db.assistantSessions.list(projectKey, { includeArchived }));
    return NextResponse.json({ sessions });
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { projectKey?: unknown; new?: unknown };
  const projectKey = typeof body.projectKey === "string" ? body.projectKey : "PLAN";
  const forceNew = body.new === true;
  return withDb(async (db) => {
    try {
      const session = forceNew
        ? (await db.assistantSessions.create(projectKey))
        : (await db.assistantSessions.getOrCreateActive(projectKey));
      return NextResponse.json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open assistant session.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
