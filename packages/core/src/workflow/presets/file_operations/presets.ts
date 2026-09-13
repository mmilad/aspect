import type { WorkflowPreset } from "../types";
import { fileListGraph, fileReadGraph, fileWriteGraph } from "./graphs";

export const fileListPreset: WorkflowPreset = {
  presetKey: "file_list",
  presetVersion: 1,
  title: "List workspace files",
  summary: "List bounded files under the managed project workspace.",
  body: "Read-only file discovery for an explicitly assigned specialist workflow. Paths remain bounded by the workspace adapter.",
  status: "accepted",
  kind: "user",
  graph: fileListGraph
};

export const fileReadPreset: WorkflowPreset = {
  presetKey: "file_read",
  presetVersion: 1,
  title: "Read workspace file",
  summary: "Read one bounded UTF-8 file from the managed project workspace.",
  body: "Read-only file access for an explicitly assigned specialist workflow. The adapter enforces workspace boundaries and byte limits.",
  status: "accepted",
  kind: "user",
  graph: fileReadGraph
};

export const fileWritePreset: WorkflowPreset = {
  presetKey: "file_write",
  presetVersion: 1,
  title: "Write workspace file",
  summary: "Write one bounded file in the managed project workspace.",
  body: "This is a mutating file workflow. Assign it only to a specialist that is explicitly authorized to write project files.",
  status: "accepted",
  kind: "user",
  graph: fileWriteGraph
};
