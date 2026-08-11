import { NextResponse } from "next/server";
import { createExampleProject } from "@projectplaner/db";
import { withDb } from "../../../../lib/plan-api";

export async function POST() {
  try {
    return await withDb(async (db) => {
      const result = await createExampleProject(db);
      return NextResponse.json(result, { status: 201 });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create example project.";
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
