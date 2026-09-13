import { WORKFLOW_SCHEMA_VERSION, type BagShape } from "../../nodes";
import type { WorkflowGraph } from "../../graph";
import { identityBindings } from "../bindings";

const STRING: BagShape = { kind: "primitive", type: "string" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const ENTRIES: BagShape = {
  kind: "array",
  items: { kind: "object", fields: { path: STRING, kind: STRING, bytes: { kind: "union", options: [NUMBER, { kind: "primitive", type: "null" }] } } }
};

export const fileListGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "path", role: "input", shape: STRING, required: false },
    { name: "recursive", role: "input", shape: BOOLEAN, required: false },
    { name: "maxEntries", role: "input", shape: NUMBER, required: false },
    { name: "entries", role: "output", shape: ENTRIES, required: true }
  ],
  nodes: [
    { id: "start", type: "start", position: { x: 40, y: 160 }, data: { title: "Start", writes: ["path", "recursive", "maxEntries"], writeBindings: identityBindings(["path", "recursive", "maxEntries"]), outputContracts: { path: { required: false, shape: STRING }, recursive: { required: false, shape: BOOLEAN }, maxEntries: { required: false, shape: NUMBER } } } },
    { id: "list", type: "file_list", position: { x: 320, y: 160 }, data: { title: "List workspace files", inputs: { path: { required: false, shape: STRING }, recursive: { required: false, shape: BOOLEAN }, maxEntries: { required: false, shape: NUMBER } }, outputContracts: { entries: { required: true, shape: ENTRIES } }, fileList: {} } },
    { id: "end", type: "end", position: { x: 620, y: 160 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_list", source: "start", target: "list", kind: "next" },
    { id: "e_list_end", source: "list", target: "end", kind: "next" },
    { id: "d_path", source: "start", target: "list", kind: "data", sourcePin: "path", targetPin: "path" },
    { id: "d_recursive", source: "start", target: "list", kind: "data", sourcePin: "recursive", targetPin: "recursive" },
    { id: "d_max_entries", source: "start", target: "list", kind: "data", sourcePin: "maxEntries", targetPin: "maxEntries" },
    { id: "d_entries", source: "list", target: "end", kind: "data", sourcePin: "entries", targetPin: "entries" }
  ]
};

export const fileReadGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "path", role: "input", shape: STRING, required: true },
    { name: "maxBytes", role: "input", shape: NUMBER, required: false },
    { name: "readPath", role: "output", shape: STRING, required: true },
    { name: "content", role: "output", shape: STRING, required: true },
    { name: "bytes", role: "output", shape: NUMBER, required: true },
    { name: "truncated", role: "output", shape: BOOLEAN, required: true },
    { name: "encoding", role: "output", shape: STRING, required: true }
  ],
  nodes: [
    { id: "start", type: "start", position: { x: 40, y: 160 }, data: { title: "Start", writes: ["path", "maxBytes"], writeBindings: identityBindings(["path", "maxBytes"]), outputContracts: { path: { required: true, shape: STRING }, maxBytes: { required: false, shape: NUMBER } } } },
    { id: "read", type: "file_read", position: { x: 320, y: 160 }, data: { title: "Read workspace file", inputs: { path: { required: true, shape: STRING }, maxBytes: { required: false, shape: NUMBER } }, outputContracts: { path: { required: true, shape: STRING }, content: { required: true, shape: STRING }, bytes: { required: true, shape: NUMBER }, truncated: { required: true, shape: BOOLEAN }, encoding: { required: true, shape: STRING } }, fileRead: {} } },
    { id: "end", type: "end", position: { x: 620, y: 160 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_read", source: "start", target: "read", kind: "next" },
    { id: "e_read_end", source: "read", target: "end", kind: "next" },
    { id: "d_path", source: "start", target: "read", kind: "data", sourcePin: "path", targetPin: "path" },
    { id: "d_max_bytes", source: "start", target: "read", kind: "data", sourcePin: "maxBytes", targetPin: "maxBytes" },
    { id: "d_read_path", source: "read", target: "end", kind: "data", sourcePin: "path", targetPin: "readPath" },
    { id: "d_content", source: "read", target: "end", kind: "data", sourcePin: "content", targetPin: "content" },
    { id: "d_bytes", source: "read", target: "end", kind: "data", sourcePin: "bytes", targetPin: "bytes" },
    { id: "d_truncated", source: "read", target: "end", kind: "data", sourcePin: "truncated", targetPin: "truncated" },
    { id: "d_encoding", source: "read", target: "end", kind: "data", sourcePin: "encoding", targetPin: "encoding" }
  ]
};

export const fileWriteGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "path", role: "input", shape: STRING, required: true },
    { name: "content", role: "input", shape: STRING, required: true },
    { name: "overwrite", role: "input", shape: BOOLEAN, required: false },
    { name: "writtenPath", role: "output", shape: STRING, required: true },
    { name: "bytes", role: "output", shape: NUMBER, required: true },
    { name: "created", role: "output", shape: BOOLEAN, required: true },
    { name: "overwritten", role: "output", shape: BOOLEAN, required: true }
  ],
  nodes: [
    { id: "start", type: "start", position: { x: 40, y: 160 }, data: { title: "Start", writes: ["path", "content", "overwrite"], writeBindings: identityBindings(["path", "content", "overwrite"]), outputContracts: { path: { required: true, shape: STRING }, content: { required: true, shape: STRING }, overwrite: { required: false, shape: BOOLEAN } } } },
    { id: "write", type: "file_write", position: { x: 320, y: 160 }, data: { title: "Write workspace file", inputs: { path: { required: true, shape: STRING }, content: { required: true, shape: STRING }, overwrite: { required: false, shape: BOOLEAN } }, outputContracts: { path: { required: true, shape: STRING }, bytes: { required: true, shape: NUMBER }, created: { required: true, shape: BOOLEAN }, overwritten: { required: true, shape: BOOLEAN } }, fileWrite: {} } },
    { id: "end", type: "end", position: { x: 620, y: 160 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_write", source: "start", target: "write", kind: "next" },
    { id: "e_write_end", source: "write", target: "end", kind: "next" },
    { id: "d_path", source: "start", target: "write", kind: "data", sourcePin: "path", targetPin: "path" },
    { id: "d_content", source: "start", target: "write", kind: "data", sourcePin: "content", targetPin: "content" },
    { id: "d_overwrite", source: "start", target: "write", kind: "data", sourcePin: "overwrite", targetPin: "overwrite" },
    { id: "d_written_path", source: "write", target: "end", kind: "data", sourcePin: "path", targetPin: "writtenPath" },
    { id: "d_bytes", source: "write", target: "end", kind: "data", sourcePin: "bytes", targetPin: "bytes" },
    { id: "d_created", source: "write", target: "end", kind: "data", sourcePin: "created", targetPin: "created" },
    { id: "d_overwritten", source: "write", target: "end", kind: "data", sourcePin: "overwritten", targetPin: "overwritten" }
  ]
};
