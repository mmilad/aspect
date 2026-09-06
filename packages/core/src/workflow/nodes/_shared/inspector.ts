import type { WorkflowNodeData } from "./types";
import { getDataPath as getRecordPath, setDataPath as setRecordPath } from "../../../json-path";

/** Declarative inspector field — rendered by the web WorkflowStepInspector. */
export type WorkflowInspectorField =
  | {
      kind: "text" | "textarea" | "number";
      label: string;
      /** Dot path under node.data (e.g. llm.instructions). */
      path: string;
      placeholder?: string;
    }
  | {
      kind: "select";
      label: string;
      path: string;
      options: Array<{ value: string; label: string }>;
    }
  | {
      kind: "bagKey";
      label: string;
      path: string;
    }
  | {
      /** Shared timeout / idempotency / onExhausted block for tool|llm|write. */
      kind: "executionPolicy";
    }
  | {
      /** Map field list editor. */
      kind: "mapFields";
    }
  | {
      /** Tool argsFromBag first-mapping picker. */
      kind: "toolArgs";
    }
  | {
      /** Reads/writes ports with required + shape contracts. */
      kind: "bagPorts";
    }
  | {
      /** LLM node: pick a centralized JSON Schema by key (searchable select). */
      kind: "llmSchemaKey";
      label: string;
    }
  | {
      /** Query node: op, slots, and catalog const fields. Rematerializes data pins. */
      kind: "queryConfig";
    };

export function getDataPath(data: WorkflowNodeData, path: string): unknown {
  return getRecordPath(data, path);
}

/** Immutable set of a dotted path on node data (creates intermediate objects). */
export function setDataPath(data: WorkflowNodeData, path: string, value: unknown): WorkflowNodeData {
  return setRecordPath(data as Record<string, unknown>, path, value) as WorkflowNodeData;
}
