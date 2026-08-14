import type { PendingLlmSurface } from "../client/types";

/**
 * Build a slim host prompt around workflow-provided system + task instructions.
 * Prefer flow instructionRef / bag templates; this is adapter glue only.
 * Labeled sections map to chat system vs user when a provider supports roles.
 */
export function buildAdapterPrompt(pending: PendingLlmSurface): string {
  const schema =
    pending.outputSchema.length > 0
      ? pending.outputSchema.map((key) => `- ${key}`).join("\n")
      : "- (no outputSchema; return a JSON object of writes)";
  const formatLines =
    pending.format === "json_schema" && pending.jsonSchema
      ? [
          "Response format: json_schema",
          pending.schemaKey ? `JSON schema key: ${pending.schemaKey}` : "",
          "JSON Schema:",
          JSON.stringify(pending.jsonSchema)
        ].filter(Boolean)
      : pending.format
        ? [`Response format: ${pending.format}`]
        : ["Reply with a single JSON object only (no markdown) whose keys match the output schema."];

  return [
    "You are filling a Projectplaner workflow LLM node.",
    ...formatLines,
    "",
    "=== SYSTEM ===",
    pending.systemPrompt.trim() || "(empty)",
    "",
    "=== TASK ===",
    pending.instructions.trim() || "(empty)",
    "",
    "Output schema:",
    schema,
    "",
    "Declared reads (JSON):",
    JSON.stringify(pending.reads ?? {}, null, 2)
  ].join("\n");
}

/** Pull the first JSON object from model text and keep outputSchema keys when listed. */
export function parseLlmWrites(
  text: string,
  outputSchema: string[] = [],
  options?: { format?: string }
): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Model response did not contain a JSON object for llmWrites.");
  }
  const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model response JSON must be an object for llmWrites.");
  }
  const record = parsed as Record<string, unknown>;
  if (outputSchema.length === 0) {
    return record;
  }
  if (
    options?.format === "json_schema" &&
    outputSchema.length === 1 &&
    !(outputSchema[0]! in record)
  ) {
    return { [outputSchema[0]!]: record };
  }
  const writes: Record<string, unknown> = {};
  for (const key of outputSchema) {
    if (key in record) {
      writes[key] = record[key];
    }
  }
  if (Object.keys(writes).length === 0) {
    throw new Error(`Model JSON missing required outputSchema keys: ${outputSchema.join(", ")}`);
  }
  return writes;
}
