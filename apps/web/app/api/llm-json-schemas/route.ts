import { NextResponse } from "next/server";

import { withDb } from "../../../lib/plan-api";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaResponse(row: {
  id?: string;
  key: string;
  title: string;
  description: string;
  version: number;
  schema: Record<string, unknown>;
}) {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    version: row.version,
    schema: row.schema
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectKey = url.searchParams.get("projectKey") ?? "PLAN";

  return withDb(async (db) => {
    const schemas = (await db.llmJsonSchemas.list(projectKey))
      .filter((row) => row.status === "active")
      .map(schemaResponse);
    return NextResponse.json({ schemas });
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectKey?: unknown;
    key?: unknown;
    title?: unknown;
    description?: unknown;
    schema?: unknown;
  };

  if (typeof body.key !== "string" || typeof body.title !== "string" || !isJsonObject(body.schema)) {
    return NextResponse.json({ error: "Key, title, and JSON schema object are required." }, { status: 400 });
  }

  const projectKey = typeof body.projectKey === "string" ? body.projectKey : "PLAN";
  const key = body.key;
  const title = body.title;
  const description = typeof body.description === "string" ? body.description : "";
  const schemaObject = body.schema;

  return withDb(async (db) => {
    try {
      const created = (await db.llmJsonSchemas.create({
        projectKey,
        key,
        title,
        description,
        schema: schemaObject
      }));
      return NextResponse.json({ schema: schemaResponse(created) }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create schema.";
      const status = message.includes("already exists") ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  });
}
