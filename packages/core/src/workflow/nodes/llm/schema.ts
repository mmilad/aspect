import { asStringArray, isRecord } from "../_shared/schema";
import {
  workflowLlmFormats,
  type WorkflowLlmConfig,
  type WorkflowLlmFormat,
  type WorkflowNodeData
} from "../_shared/types";

function parseLlmFormat(raw: unknown, nodeId: string, errors: string[]): WorkflowLlmFormat | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  if (typeof raw !== "string" || !workflowLlmFormats.includes(raw as WorkflowLlmFormat)) {
    errors.push(`Node ${nodeId} llm.format must be text, json, or json_schema.`);
    return undefined;
  }
  return raw as WorkflowLlmFormat;
}

export function parseLlmConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowLlmConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} llm config must be an object.`);
    return undefined;
  }
  const schemaKey =
    typeof raw.schemaKey === "string" && raw.schemaKey.trim() ? raw.schemaKey.trim() : undefined;
  const format = parseLlmFormat(raw.format, nodeId, errors);
  return {
    systemPrompt: typeof raw.systemPrompt === "string" ? raw.systemPrompt : undefined,
    instructions: typeof raw.instructions === "string" ? raw.instructions : undefined,
    instructionRef: typeof raw.instructionRef === "string" ? raw.instructionRef : undefined,
    tools: asStringArray(raw.tools),
    inputKeys: asStringArray(raw.inputKeys),
    outputSchema: asStringArray(raw.outputSchema),
    format: format ?? (schemaKey ? "json_schema" : undefined),
    schemaKey
  };
}

export function parseLlmNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const llm = parseLlmConfig(raw.llm, nodeId, errors);
  return llm ? { llm } : {};
}
