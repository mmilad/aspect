import { NextResponse } from "next/server";
import { withDb } from "../../../../lib/plan-api";
import { runAssistantTurn } from "../../../../lib/run-assistant-turn";

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId?: unknown; message?: unknown; patch?: unknown };
  const sessionId = body.sessionId;
  const message = body.message;
  if (typeof sessionId !== "string" || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "sessionId and message are required." }, { status: 400 });
  }
  return withDb(async (db) => {
    try {
      const session = await runAssistantTurn(db, {
        sessionId,
        message: message.trim(),
        patch: body.patch
      });
      return NextResponse.json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Turn failed.";
      const status = message.includes("Unknown") ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  });
}
