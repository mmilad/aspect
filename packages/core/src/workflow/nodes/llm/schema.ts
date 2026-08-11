import { asStringArray, isRecord } from "../_shared/schema";
import type { WorkflowLlmConfig, WorkflowNodeData } from "../_shared/types";

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
  return {
    systemPrompt: typeof raw.systemPrompt === "string" ? raw.systemPrompt : undefined,
    instructions: typeof raw.instructions === "string" ? raw.instructions : undefined,
    instructionRef: typeof raw.instructionRef === "string" ? raw.instructionRef : undefined,
    tools: asStringArray(raw.tools),
    inputKeys: asStringArray(raw.inputKeys),
    outputSchema: asStringArray(raw.outputSchema)
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
