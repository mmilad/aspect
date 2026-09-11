import { NextResponse } from "next/server";
import { getDatabaseController } from "@projectplaner/db";

type Context = { params: Promise<{ runId: string }> };
export async function GET(_: Request, { params }: Context) {
  const run = await getDatabaseController().agentRuns.get((await params).runId);
  return run ? NextResponse.json(run) : NextResponse.json({ error: "Run not found." }, { status: 404 });
}
export async function POST(_: Request, { params }: Context) {
  const db = getDatabaseController();
  const run = await db.agentRuns.get((await params).runId);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  const canceled = await db.agentRuns.finish({
    ...run, status: "canceled", finishedAt: new Date().toISOString()
  });
  return NextResponse.json(canceled);
}
