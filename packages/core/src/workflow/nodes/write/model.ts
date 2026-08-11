import type { WorkflowNodeModel } from "../_shared/model";
import { executeWrite } from "./execute";
import { writeInspectorFields } from "./inspector";
import { parseWriteNodeConfig } from "./schema";

export const writeNode: WorkflowNodeModel = {
  type: "write",
  kind: "work",
  configKey: "write",
  defaultData: () => ({
    title: "Write",
    reads: [],
    writes: [],
    write: { action: "create_entity" }
  }),
  parseConfig: parseWriteNodeConfig,
  execute: executeWrite,
  inspectorFields: writeInspectorFields
};
