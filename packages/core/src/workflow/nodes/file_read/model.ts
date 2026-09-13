import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeFileRead } from "./execute";
import { parseFileReadNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };

export const fileReadNode: WorkflowNodeModel = {
  type: "file_read",
  kind: "work",
  category: "operation",
  sideEffect: "read",
  configKey: "fileRead",
  defaultData: () => ({
    title: "Read workspace file",
    inputs: { path: { required: true, shape: STRING }, maxBytes: { required: false, shape: NUMBER } },
    outputContracts: { path: { required: true, shape: STRING }, content: { required: true, shape: STRING }, bytes: { required: true, shape: NUMBER }, truncated: { required: true, shape: BOOLEAN }, encoding: { required: true, shape: STRING } },
    fileRead: {}
  }),
  parseConfig: parseFileReadNodeConfig,
  execute: executeFileRead,
  dataInputs: () => ["path", "maxBytes"],
  dataOutputs: () => ["path", "content", "bytes", "truncated", "encoding"],
  execInputDescriptions: () => ({ in: "Read one bounded UTF-8 file from the managed project workspace." }),
  execOutputDescriptions: () => ({ then: "Continue with the file contents." }),
  canvasFields: () => [{ label: "capability", value: "files.read" }]
};
