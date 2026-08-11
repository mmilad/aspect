import { NextResponse } from "next/server";
import { getProjectStats } from "@projectplaner/db";
import { withDb } from "../../../../../lib/plan-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;

  return withDb(async (db) => {
    const stats = await getProjectStats(db, key);
    if (!stats) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ stats });
  });
}
