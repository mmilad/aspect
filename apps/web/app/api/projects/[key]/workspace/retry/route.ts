import { NextResponse } from "next/server";
import { withDb } from "../../../../../../lib/plan-api";
import { provisionProjectWorkspace } from "../../../../../../lib/project-workspace";
import { workspaceHttpError } from "../../../../../../lib/workspace-http";

export async function POST(_request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    return await withDb(async (db) => NextResponse.json(await provisionProjectWorkspace(db, key, null, true)));
  } catch (error) { return workspaceHttpError(error); }
}
