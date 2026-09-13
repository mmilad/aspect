import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeFileWrite } from "./execute";
import { parseFileWriteNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };

export const fileWriteNode: WorkflowNodeModel = {
  type: "file_write",
  kind: "work",
  category: "operation",
  sideEffect: "write",
  configKey: "fileWrite",
  defaultData: () => ({
    title: "Write workspace file",
    inputs: { path: { required: true, shape: STRING }, content: { required: true, shape: STRING }, overwrite: { required: false, shape: BOOLEAN } },
    outputContracts: { path: { required: true, shape: STRING }, bytes: { required: true, shape: NUMBER }, created: { required: true, shape: BOOLEAN }, overwritten: { required: true, shape: BOOLEAN } },
    fileWrite: {}
  }),
  parseConfig: parseFileWriteNodeConfig,
  execute: executeFileWrite,
  dataInputs: () => ["path", "content", "overwrite"],
  dataOutputs: () => ["path", "bytes", "created", "overwritten"],
  execInputDescriptions: () => ({ in: "Write a bounded file only when the containing specialist workflow is authorized." }),
  execOutputDescriptions: () => ({ then: "Continue with the confirmed file-write result." }),
  canvasFields: () => [{ label: "capability", value: "files.write" }]
};
