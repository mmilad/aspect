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
export type TaskStatus = "todo" | "doing" | "blocked" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type EntityType = NodeType | "task";
export type EntityStatus = NodeStatus | TaskStatus;
export type TaskLinkType = "affects" | "implements" | "validates" | "investigates";
export type EntityRelationType = RelationType | TaskLinkType | "blocked_by" | "related_to" | "supports" | "motivates";
export type TagKind = "priority" | "domain" | "workflow" | "risk" | "custom";

export type JsonRecord = Record<string, unknown>;

export interface Entity {
  id: string;
  projectId: string;
  type: EntityType;
  key: string | null;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: EntityStatus;
  sortOrder: number;
  metadata: JsonRecord;
}

export interface EntityRelation {
  id: string;
  projectId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: EntityRelationType;
  label: string | null;
  isPrimary: boolean;
  metadata: JsonRecord;
}

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

export interface EntityRef {
  type: EntityType;
  id: string;
}

export interface Feature {
  id: string;
  projectId: string;
  parentFeatureId: string | null;
  key: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: NodeStatus;
  acceptanceShape: string;
  sortOrder: number;
  metadata: JsonRecord;
}

export interface FeatureAspectLink {
  id: string;
  featureId: string;
  aspectId: string;
  type: TaskLinkType;
  isPrimary: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  acceptanceCriteria: string[];
  sortOrder: number;
  metadata: JsonRecord;
}

export interface TaskLink {
  id: string;
  taskId: string;
  targetType: "aspect" | "feature";
  targetId: string;
  type: TaskLinkType;
  isPrimary: boolean;
}

export interface LegacyEntityRelation {
  id: string;
  projectId: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  type: EntityRelationType;
  label: string | null;
  metadata: JsonRecord;
}

export interface Tag {
  id: string;
  projectId: string;
  slug: string;
  label: string;
  kind: TagKind;
}

export interface TagAssignment {
  id: string;
  tagId: string;
  targetType: EntityType;
  targetId: string;
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
  features: Feature[];
  featureAspectLinks: FeatureAspectLink[];
  tasks: Task[];
  taskLinks: TaskLink[];
  entityRelations: LegacyEntityRelation[];
  tags: Tag[];
  tagAssignments: TagAssignment[];
}
