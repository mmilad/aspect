import { NextResponse } from "next/server";
import { listLlmJsonSchemas } from "@projectplaner/db";
import { withDb } from "../../../lib/plan-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectKey = url.searchParams.get("projectKey") ?? "PLAN";

  return withDb(async (db) => {
    const schemas = listLlmJsonSchemas(db, projectKey)
      .filter((row) => row.status === "active")
      .map((row) => ({
        key: row.key,
        title: row.title,
        description: row.description,
        version: row.version,
        schema: row.schema
      }));
    return NextResponse.json({ schemas });
  });
}
