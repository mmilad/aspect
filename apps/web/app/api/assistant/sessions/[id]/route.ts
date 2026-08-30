import { NextResponse } from "next/server";
import assistant from "@projectplaner/core/assistant";
import assistantSessions from "@projectplaner/db/assistant-sessions";
import { withDb } from "../../../../../lib/plan-api";

const { merge, parsePatch } = assistant;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withDb(async (db) => {
    const session = assistantSessions.get(db, id);
    if (!session) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ session });
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { context?: unknown; session?: unknown; patch?: unknown };
  return withDb(async (db) => {
    const existing = assistantSessions.get(db, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    try {
      let next = existing.session;
      if (body.session && typeof body.session === "object") {
        next = assistant.parseSession(body.session, existing.session.context.projectKey);
      }
      if (body.patch !== undefined) {
        next = merge(next, parsePatch(body.patch));
      }
      if (body.context !== undefined) {
        next = merge(next, parsePatch({ context: body.context }));
      }
      const session = assistantSessions.save(db, id, next);
      return NextResponse.json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save session.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
