import { getLlmJsonSchemaPreset } from "./llm-json-schemas";
import type { ResolvedLlmJsonSchema, WorkflowAdapters } from "../runtime/adapters";
import type { WorkflowLlmFormat } from "../nodes/_shared/types";

export type LlmNodeFormatResolution =
  | {
      ok: true;
      format: WorkflowLlmFormat;
      schemaKey?: string;
      resolved?: ResolvedLlmJsonSchema;
    }
  | { ok: false; error: string };

/**
 * Resolve LLM wire format + optional centralized JSON Schema.
 * Adapter (DB) first; catalog presets as fallback for tests / missing adapter.
 */
export async function resolveLlmNodeFormat(input: {
  format?: WorkflowLlmFormat;
  schemaKey?: string;
  adapters?: WorkflowAdapters;
}): Promise<LlmNodeFormatResolution> {
  const schemaKey = input.schemaKey?.trim() || undefined;
  const format: WorkflowLlmFormat = input.format ?? (schemaKey ? "json_schema" : "text");

  if (!schemaKey) {
    if (format === "json_schema") {
      return { ok: false, error: "LLM format json_schema requires llm.schemaKey." };
    }
    return { ok: true, format };
  }

  const fromAdapter = await input.adapters?.resolveLlmJsonSchema?.(schemaKey);
  if (fromAdapter?.schema) {
    return { ok: true, format: "json_schema", schemaKey, resolved: fromAdapter };
  }

  const preset = getLlmJsonSchemaPreset(schemaKey);
  if (preset) {
    return {
      ok: true,
      format: "json_schema",
      schemaKey,
      resolved: { key: preset.key, schema: preset.schema, version: 1 }
    };
  }

  return { ok: false, error: `Unknown LLM JSON schema key '${schemaKey}'.` };
}
