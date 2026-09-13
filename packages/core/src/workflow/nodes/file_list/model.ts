import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeFileList } from "./execute";
import { parseFileListNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const ENTRIES: BagShape = {
  kind: "array",
  items: { kind: "object", fields: { path: STRING, kind: STRING, bytes: { kind: "union", options: [NUMBER, { kind: "primitive", type: "null" }] } } }
};

export const fileListNode: WorkflowNodeModel = {
  type: "file_list",
  kind: "work",
  category: "operation",
  sideEffect: "read",
  configKey: "fileList",
  defaultData: () => ({
    title: "List workspace files",
    inputs: { path: { required: false, shape: STRING }, recursive: { required: false, shape: BOOLEAN }, maxEntries: { required: false, shape: NUMBER } },
    outputContracts: { entries: { required: true, shape: ENTRIES } },
    fileList: {}
  }),
  parseConfig: parseFileListNodeConfig,
  execute: executeFileList,
  dataInputs: () => ["path", "recursive", "maxEntries"],
  dataOutputs: () => ["entries"],
  execInputDescriptions: () => ({ in: "List files under the managed project workspace." }),
  execOutputDescriptions: () => ({ then: "Continue with the bounded file listing." }),
  canvasFields: () => [{ label: "capability", value: "files.list" }]
};
