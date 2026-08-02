export const nodeTypes = [
  "project",
  "aspect",
  "entry",
  "area",
  "surface",
  "feature",
  "flow",
  "decision",
  "question",
  "reference",
  "task_group"
] as const;

export type NodeType = (typeof nodeTypes)[number];

export const relationTypes = [
  "contains",
  "leads_to",
  "depends_on",
  "blocks",
  "implements",
  "affects",
  "answers",
  "references",
  "conflicts_with"
] as const;

export type RelationType = (typeof relationTypes)[number];

export type NodeStatus =
  | "not_implemented"
  | "in_work"
  | "implemented"
  | "planned"
  | "active"
  | "blocked"
  | "accepted"
  | "answered"
  | "archived";

export type DraftStatus = "draft" | "reviewed" | "accepted" | "rejected" | "archived";
export type DraftChangeType = "create" | "update" | "delete";
export type DraftTargetType = "node" | "relation";
export type TaskStatus = "todo" | "doing" | "blocked" | "done";

export type JsonRecord = Record<string, unknown>;

export interface ProjectNode {
  id: string;
  projectId: string;
  parentId: string | null;
  type: NodeType;
  slug: string;
  path: string;
  title: string;
  summary: string;
  body: string;
  status: NodeStatus;
  sortOrder: number;
  metadata: JsonRecord;
}

export interface ProjectRelation {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: RelationType;
  label: string | null;
  metadata: JsonRecord;
}

export interface DraftPlan {
  id: string;
  projectId: string;
  title: string;
  scopeNodeId: string | null;
  hypothesis: string;
  status: DraftStatus;
  metadata: JsonRecord;
}

export interface DraftChange {
  id: string;
  draftPlanId: string;
  changeType: DraftChangeType;
  targetType: DraftTargetType;
  targetId: string | null;
  payload: JsonRecord;
}

export interface NodeTask {
  id: string;
  nodeId: string;
  title: string;
  status: TaskStatus;
  acceptanceCriteria: string[];
  sortOrder: number;
}

export interface ProjectPlanSnapshot {
  project: {
    id: string;
    key: string;
    title: string;
    description: string;
  };
  nodes: ProjectNode[];
  relations: ProjectRelation[];
  draftPlans: DraftPlan[];
  draftChanges: DraftChange[];
  tasks: NodeTask[];
}
