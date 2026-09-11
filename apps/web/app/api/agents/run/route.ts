import { NextResponse } from "next/server";
import { agentConversation, parseAgentProfile } from "@projectplaner/core";
import { getDatabaseController } from "@projectplaner/db";
import generator from "@projectplaner/core/generator";
import { createAgentRuntime } from "../../../../lib/create-agent-runtime";

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";
  const task = typeof body?.message === "string" ? body.message.trim() : "";
  const projectKey = typeof body?.projectKey === "string" ? body.projectKey.trim() : "PLAN";
  if (!agentId || !task || !projectKey) {
    return NextResponse.json({ error: "agentId, message and projectKey are required." }, { status: 400 });
  }
  try {
    const db = getDatabaseController();
    const entity = await db.entities.get(agentId);
    const project = await db.projects.findByKey(projectKey);
    if (!entity || entity.type !== "agent" || !project || entity.projectId !== project.id) {
      return NextResponse.json({ error: "Agent not found in project." }, { status: 404 });
    }
    const config = generator.author.readLlmChatConfigFromEnv();
    if (!config) return NextResponse.json({ error: "LLM is not configured." }, { status: 503 });
    const history = agentConversation(await db.agentRuns.list(agentId, projectKey), agentId, projectKey);
    const runtime = createAgentRuntime(db, agentId, projectKey, parseAgentProfile(entity.metadata), config, history);
    // Await execution: this local host has no durable background job owner.
    const run = await runtime.start({ agentId, task, projectKey });
    return NextResponse.json(run, { status: run.status === "failed" ? 502 : 200 });
  } catch {
    return NextResponse.json({ error: "Could not execute agent run." }, { status: 500 });
  }
}
