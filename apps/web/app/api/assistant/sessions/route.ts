import { NextResponse } from "next/server";
import assistantSessions from "@projectplaner/db/assistant-sessions";
import { withDb } from "../../../../lib/plan-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectKey = url.searchParams.get("projectKey") ?? "PLAN";
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  return withDb(async (db) => {
    const sessions = assistantSessions.list(db, projectKey, { includeArchived });
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
        ? assistantSessions.create(db, projectKey)
        : assistantSessions.getOrCreateActive(db, projectKey);
      return NextResponse.json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open assistant session.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
