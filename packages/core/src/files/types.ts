export type WorkflowFileEntry = {
  path: string;
  kind: "file" | "directory";
  bytes?: number;
};

export type WorkflowFileListInput = {
  path?: string;
  recursive?: boolean;
  maxEntries?: number;
};

export type WorkflowFileListResult = {
  entries: WorkflowFileEntry[];
};

export type WorkflowFileReadInput = {
  path: string;
  maxBytes?: number;
};

export type WorkflowFileReadResult = {
  path: string;
  content: string;
  bytes: number;
  truncated: boolean;
  encoding: "utf8";
};

export type WorkflowFileWriteInput = {
  path: string;
  content: string;
  overwrite?: boolean;
};

export type WorkflowFileWriteResult = {
  path: string;
  bytes: number;
  created: boolean;
  overwritten: boolean;
};
