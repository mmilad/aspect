import { NextResponse } from "next/server";
import { withDb } from "../../../../../../lib/plan-api";
import { revealProjectWorkspace } from "../../../../../../lib/project-workspace";
import { workspaceHttpError } from "../../../../../../lib/workspace-http";

export async function POST(_request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    return await withDb(async (db) => {
      await revealProjectWorkspace(db, key);
      return NextResponse.json({ opened: true });
    });
  } catch (error) { return workspaceHttpError(error); }
}
