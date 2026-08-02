import { selfPlanningSeed, type ProjectPlanSnapshot } from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function run(db: DatabaseSync, sql: string, values: (string | number | null)[] = []): void {
  db.prepare(sql).run(...values);
}

export async function seedSelfPlanningProject(db: DatabaseSync): Promise<void> {
  run(db, "INSERT OR IGNORE INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)", [
    selfPlanningSeed.project.id,
    selfPlanningSeed.project.key,
    selfPlanningSeed.project.title,
    selfPlanningSeed.project.description
  ]);

  for (const node of selfPlanningSeed.nodes) {
    run(
      db,
      `INSERT OR IGNORE INTO nodes
       (id, project_id, parent_id, type, slug, path, title, summary, body, status, sort_order, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id,
        node.projectId,
        node.parentId,
        node.type,
        node.slug,
        node.path,
        node.title,
        node.summary,
        node.body,
        node.status,
        node.sortOrder,
        JSON.stringify(node.metadata)
      ]
    );
  }

  for (const relation of selfPlanningSeed.relations) {
    run(
      db,
      `INSERT OR IGNORE INTO relations
       (id, project_id, source_node_id, target_node_id, type, label, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        relation.id,
        relation.projectId,
        relation.sourceNodeId,
        relation.targetNodeId,
        relation.type,
        relation.label,
        JSON.stringify(relation.metadata)
      ]
    );
  }

  for (const draft of selfPlanningSeed.draftPlans) {
    run(
      db,
      `INSERT OR IGNORE INTO draft_plans
       (id, project_id, title, scope_node_id, hypothesis, status, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.id,
        draft.projectId,
        draft.title,
        draft.scopeNodeId,
        draft.hypothesis,
        draft.status,
        JSON.stringify(draft.metadata)
      ]
    );
  }

  for (const change of selfPlanningSeed.draftChanges) {
    run(
      db,
      `INSERT OR IGNORE INTO draft_changes
       (id, draft_plan_id, change_type, target_type, target_id, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [change.id, change.draftPlanId, change.changeType, change.targetType, change.targetId, JSON.stringify(change.payload)]
    );
  }

  for (const feature of selfPlanningSeed.features) {
    run(
      db,
      `INSERT OR IGNORE INTO features
       (id, project_id, parent_feature_id, key, slug, title, summary, body, status, acceptance_shape, sort_order, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        feature.id,
        feature.projectId,
        feature.parentFeatureId,
        feature.key,
        feature.slug,
        feature.title,
        feature.summary,
        feature.body,
        feature.status,
        feature.acceptanceShape,
        feature.sortOrder,
        JSON.stringify(feature.metadata)
      ]
    );
  }

  for (const link of selfPlanningSeed.featureAspectLinks) {
    run(
      db,
      `INSERT OR IGNORE INTO feature_aspect_links
       (id, feature_id, aspect_id, type, is_primary)
       VALUES (?, ?, ?, ?, ?)`,
      [link.id, link.featureId, link.aspectId, link.type, link.isPrimary ? 1 : 0]
    );
  }

  for (const task of selfPlanningSeed.tasks) {
    run(
      db,
      `INSERT OR IGNORE INTO tasks
       (id, project_id, key, title, description, status, priority, acceptance_criteria_json, sort_order, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.projectId,
        task.key,
        task.title,
        task.description,
        task.status,
        task.priority,
        JSON.stringify(task.acceptanceCriteria),
        task.sortOrder,
        JSON.stringify(task.metadata)
      ]
    );
  }

  for (const link of selfPlanningSeed.taskLinks) {
    run(
      db,
      `INSERT OR IGNORE INTO task_links
       (id, task_id, target_type, target_id, type, is_primary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [link.id, link.taskId, link.targetType, link.targetId, link.type, link.isPrimary ? 1 : 0]
    );
  }

  for (const relation of selfPlanningSeed.entityRelations) {
    run(
      db,
      `INSERT OR IGNORE INTO entity_relations
       (id, project_id, source_type, source_id, target_type, target_id, type, label, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        relation.id,
        relation.projectId,
        relation.sourceType,
        relation.sourceId,
        relation.targetType,
        relation.targetId,
        relation.type,
        relation.label,
        JSON.stringify(relation.metadata)
      ]
    );
  }

  for (const tag of selfPlanningSeed.tags) {
    run(
      db,
      `INSERT OR IGNORE INTO tags
       (id, project_id, slug, label, kind)
       VALUES (?, ?, ?, ?, ?)`,
      [tag.id, tag.projectId, tag.slug, tag.label, tag.kind]
    );
  }

  for (const assignment of selfPlanningSeed.tagAssignments) {
    run(
      db,
      `INSERT OR IGNORE INTO tag_assignments
       (id, tag_id, target_type, target_id)
       VALUES (?, ?, ?, ?)`,
      [assignment.id, assignment.tagId, assignment.targetType, assignment.targetId]
    );
  }
}

type ProjectRow = { id: string; key: string; title: string; description: string };
type NodeRow = {
  id: string;
  project_id: string;
  parent_id: string | null;
  type: string;
  slug: string;
  path: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  sort_order: number;
  metadata_json: string;
};
type RelationRow = {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  type: string;
  label: string | null;
  metadata_json: string;
};
type DraftRow = {
  id: string;
  project_id: string;
  title: string;
  scope_node_id: string | null;
  hypothesis: string;
  status: string;
  metadata_json: string;
};
type DraftChangeRow = {
  id: string;
  draft_plan_id: string;
  change_type: string;
  target_type: string;
  target_id: string | null;
  payload_json: string;
};
type TaskRow = {
  id: string;
  project_id: string;
  key: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  acceptance_criteria_json: string;
  sort_order: number;
  metadata_json: string;
};
type FeatureRow = {
  id: string;
  project_id: string;
  parent_feature_id: string | null;
  key: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  acceptance_shape: string;
  sort_order: number;
  metadata_json: string;
};
type FeatureAspectLinkRow = {
  id: string;
  feature_id: string;
  aspect_id: string;
  type: string;
  is_primary: number;
};
type TaskLinkRow = {
  id: string;
  task_id: string;
  target_type: string;
  target_id: string;
  type: string;
  is_primary: number;
};
type EntityRelationRow = {
  id: string;
  project_id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  type: string;
  label: string | null;
  metadata_json: string;
};
type TagRow = {
  id: string;
  project_id: string;
  slug: string;
  label: string;
  kind: string;
};
type TagAssignmentRow = {
  id: string;
  tag_id: string;
  target_type: string;
  target_id: string;
};

export async function getProjectSnapshot(db: DatabaseSync, key = "PLAN"): Promise<ProjectPlanSnapshot | null> {
  const project = db.prepare("SELECT id, key, title, description FROM projects WHERE key = ?").get(key) as
    | ProjectRow
    | undefined;

  if (!project) {
    return null;
  }

  const nodes = db
    .prepare("SELECT * FROM nodes WHERE project_id = ? ORDER BY sort_order ASC")
    .all(project.id) as NodeRow[];
  const relations = db.prepare("SELECT * FROM relations WHERE project_id = ?").all(project.id) as RelationRow[];
  const drafts = db.prepare("SELECT * FROM draft_plans WHERE project_id = ?").all(project.id) as DraftRow[];
  const changes = db
    .prepare(
      `SELECT draft_changes.* FROM draft_changes
       INNER JOIN draft_plans ON draft_plans.id = draft_changes.draft_plan_id
       WHERE draft_plans.project_id = ?`
    )
    .all(project.id) as DraftChangeRow[];
  const features = db.prepare("SELECT * FROM features WHERE project_id = ? ORDER BY sort_order ASC").all(project.id) as FeatureRow[];
  const featureAspectLinks = db
    .prepare(
      `SELECT feature_aspect_links.* FROM feature_aspect_links
       INNER JOIN features ON features.id = feature_aspect_links.feature_id
       WHERE features.project_id = ?`
    )
    .all(project.id) as FeatureAspectLinkRow[];
  const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC").all(project.id) as TaskRow[];
  const taskLinks = db
    .prepare(
      `SELECT task_links.* FROM task_links
       INNER JOIN tasks ON tasks.id = task_links.task_id
       WHERE tasks.project_id = ?`
    )
    .all(project.id) as TaskLinkRow[];
  const entityRelations = db.prepare("SELECT * FROM entity_relations WHERE project_id = ?").all(project.id) as EntityRelationRow[];
  const tags = db.prepare("SELECT * FROM tags WHERE project_id = ?").all(project.id) as TagRow[];
  const tagAssignments = db
    .prepare(
      `SELECT tag_assignments.* FROM tag_assignments
       INNER JOIN tags ON tags.id = tag_assignments.tag_id
       WHERE tags.project_id = ?`
    )
    .all(project.id) as TagAssignmentRow[];

  return {
    project: {
      id: project.id,
      key: project.key,
      title: project.title,
      description: project.description
    },
    nodes: nodes.map((node) => ({
      id: node.id,
      projectId: node.project_id,
      parentId: node.parent_id,
      type: node.type as ProjectPlanSnapshot["nodes"][number]["type"],
      slug: node.slug,
      path: node.path,
      title: node.title,
      summary: node.summary,
      body: node.body,
      status: node.status as ProjectPlanSnapshot["nodes"][number]["status"],
      sortOrder: node.sort_order,
      metadata: parseJson(node.metadata_json, {})
    })),
    relations: relations.map((relation) => ({
      id: relation.id,
      projectId: relation.project_id,
      sourceNodeId: relation.source_node_id,
      targetNodeId: relation.target_node_id,
      type: relation.type as ProjectPlanSnapshot["relations"][number]["type"],
      label: relation.label,
      metadata: parseJson(relation.metadata_json, {})
    })),
    draftPlans: drafts.map((draft) => ({
      id: draft.id,
      projectId: draft.project_id,
      title: draft.title,
      scopeNodeId: draft.scope_node_id,
      hypothesis: draft.hypothesis,
      status: draft.status as ProjectPlanSnapshot["draftPlans"][number]["status"],
      metadata: parseJson(draft.metadata_json, {})
    })),
    draftChanges: changes.map((change) => ({
      id: change.id,
      draftPlanId: change.draft_plan_id,
      changeType: change.change_type as ProjectPlanSnapshot["draftChanges"][number]["changeType"],
      targetType: change.target_type as ProjectPlanSnapshot["draftChanges"][number]["targetType"],
      targetId: change.target_id,
      payload: parseJson(change.payload_json, {})
    })),
    features: features.map((feature) => ({
      id: feature.id,
      projectId: feature.project_id,
      parentFeatureId: feature.parent_feature_id,
      key: feature.key,
      slug: feature.slug,
      title: feature.title,
      summary: feature.summary,
      body: feature.body,
      status: feature.status as ProjectPlanSnapshot["features"][number]["status"],
      acceptanceShape: feature.acceptance_shape,
      sortOrder: feature.sort_order,
      metadata: parseJson(feature.metadata_json, {})
    })),
    featureAspectLinks: featureAspectLinks.map((link) => ({
      id: link.id,
      featureId: link.feature_id,
      aspectId: link.aspect_id,
      type: link.type as ProjectPlanSnapshot["featureAspectLinks"][number]["type"],
      isPrimary: Boolean(link.is_primary)
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      projectId: task.project_id,
      key: task.key,
      title: task.title,
      description: task.description,
      status: task.status as ProjectPlanSnapshot["tasks"][number]["status"],
      priority: task.priority as ProjectPlanSnapshot["tasks"][number]["priority"],
      acceptanceCriteria: parseJson(task.acceptance_criteria_json, []),
      sortOrder: task.sort_order,
      metadata: parseJson(task.metadata_json, {})
    })),
    taskLinks: taskLinks.map((link) => ({
      id: link.id,
      taskId: link.task_id,
      targetType: link.target_type as ProjectPlanSnapshot["taskLinks"][number]["targetType"],
      targetId: link.target_id,
      type: link.type as ProjectPlanSnapshot["taskLinks"][number]["type"],
      isPrimary: Boolean(link.is_primary)
    })),
    entityRelations: entityRelations.map((relation) => ({
      id: relation.id,
      projectId: relation.project_id,
      sourceType: relation.source_type as ProjectPlanSnapshot["entityRelations"][number]["sourceType"],
      sourceId: relation.source_id,
      targetType: relation.target_type as ProjectPlanSnapshot["entityRelations"][number]["targetType"],
      targetId: relation.target_id,
      type: relation.type as ProjectPlanSnapshot["entityRelations"][number]["type"],
      label: relation.label,
      metadata: parseJson(relation.metadata_json, {})
    })),
    tags: tags.map((tag) => ({
      id: tag.id,
      projectId: tag.project_id,
      slug: tag.slug,
      label: tag.label,
      kind: tag.kind as ProjectPlanSnapshot["tags"][number]["kind"]
    })),
    tagAssignments: tagAssignments.map((assignment) => ({
      id: assignment.id,
      tagId: assignment.tag_id,
      targetType: assignment.target_type as ProjectPlanSnapshot["tagAssignments"][number]["targetType"],
      targetId: assignment.target_id
    }))
  };
}

export interface CreateTaskInput {
  projectKey: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  acceptanceCriteria: string[];
  targetType: "aspect" | "feature";
  targetId: string;
  linkType: "affects" | "implements" | "validates" | "investigates";
}

export async function createTask(db: DatabaseSync, input: CreateTaskInput) {
  const project = db.prepare("SELECT id, key FROM projects WHERE key = ?").get(input.projectKey) as
    | { id: string; key: string }
    | undefined;

  if (!project) {
    throw new Error("Project not found.");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("Task title is required.");
  }

  const targetExists =
    input.targetType === "feature"
      ? Boolean(db.prepare("SELECT id FROM features WHERE id = ? AND project_id = ?").get(input.targetId, project.id))
      : Boolean(db.prepare("SELECT id FROM nodes WHERE id = ? AND project_id = ?").get(input.targetId, project.id));

  if (!targetExists) {
    throw new Error("Task target does not exist.");
  }

  const rows = db.prepare("SELECT key FROM tasks WHERE project_id = ?").all(project.id) as { key: string }[];
  const nextNumber =
    rows.reduce((max, row) => {
      const match = row.key.match(/-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
  const id = `task_${randomUUID()}`;
  const key = `${project.key}-${nextNumber}`;

  run(
    db,
    `INSERT INTO tasks
     (id, project_id, key, title, description, status, priority, acceptance_criteria_json, sort_order, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      project.id,
      key,
      title,
      input.description.trim(),
      "todo",
      input.priority,
      JSON.stringify(input.acceptanceCriteria.filter(Boolean)),
      nextNumber,
      "{}"
    ]
  );

  run(
    db,
    `INSERT INTO task_links
     (id, task_id, target_type, target_id, type, is_primary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [`tl_${randomUUID()}`, id, input.targetType, input.targetId, input.linkType, 1]
  );

  return { id, key };
}
