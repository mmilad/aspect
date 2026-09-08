import { NextResponse } from "next/server";
import generator from "@projectplaner/core/generator";
import workflow from "@projectplaner/core/workflow";

const { chatCompletions, readLlmChatConfigFromEnv } = generator.author;
const { getLlmJsonSchemaPreset, resolveWorkflowLlmSystemPrompt } = workflow.llm;

import { withDb } from "../../../../lib/plan-api";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectKey?: string;
    systemPrompt?: string;
    instructions?: string;
    format?: "text" | "json" | "json_schema";
    schemaKey?: string;
    jsonSchema?: Record<string, unknown>;
  };
  const config = readLlmChatConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      { error: "Set PROJECTPLANER_LLM_BASE_URL and PROJECTPLANER_LLM_MODEL to try LLM steps." },
      { status: 400 }
    );
  }
  const instructions = body.instructions?.trim();
  if (!instructions) {
    return NextResponse.json({ error: "Task instructions are required." }, { status: 400 });
  }

  const projectKey = body.projectKey?.trim() || "PLAN";
  const schemaKey = body.schemaKey?.trim() || undefined;
  const format = body.format ?? (schemaKey ? "json_schema" : "text");
  let jsonSchema = isJsonObject(body.jsonSchema) ? body.jsonSchema : undefined;
  if (!jsonSchema && schemaKey) {
    jsonSchema = await withDb(async (db) => (await db.llmJsonSchemas.getByKey(schemaKey, projectKey))?.schema);
    jsonSchema ??= getLlmJsonSchemaPreset(schemaKey)?.schema;
  }
  if (format === "json_schema" && !jsonSchema) {
    return NextResponse.json(
      { error: schemaKey ? `Unknown LLM JSON schema key '${schemaKey}'.` : "json_schema format requires a schemaKey." },
      { status: 400 }
    );
  }

  try {
    const raw = await chatCompletions(
      config,
      [
        { role: "system", content: resolveWorkflowLlmSystemPrompt(body.systemPrompt) },
        { role: "user", content: instructions }
      ],
      format === "json_schema" && jsonSchema
        ? { format: jsonSchema, jsonSchemaName: schemaKey ?? "llm_json" }
        : format === "json"
          ? { format: "json" }
          : undefined
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    return NextResponse.json({ raw, parsed, format, schemaKey: schemaKey ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "LLM request failed." },
      { status: 400 }
    );
  }
}
