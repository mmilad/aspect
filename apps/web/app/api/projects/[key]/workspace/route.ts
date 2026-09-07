import { NextResponse } from "next/server";
import { withDb } from "../../../../../lib/plan-api";
import { provisionProjectWorkspace, readProjectWorkspace } from "../../../../../lib/project-workspace";
import { workspaceHttpError } from "../../../../../lib/workspace-http";
import { WorkspaceError } from "@projectplaner/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ key: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { key } = await context.params;
    return await withDb(async (db) => NextResponse.json(await readProjectWorkspace(db, key)));
  } catch (error) { return workspaceHttpError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const { key } = await context.params;
    const body = await request.json().catch(() => { throw new WorkspaceError("invalid_input", "Invalid JSON request."); });
    return await withDb(async (db) => NextResponse.json(await provisionProjectWorkspace(db, key, body)));
  } catch (error) { return workspaceHttpError(error); }
}
