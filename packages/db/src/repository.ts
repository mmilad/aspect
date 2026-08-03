import {
  validateEntityGraph,
  selfPlanningSeed,
  type Entity,
  type EntityRelation,
  type EntityRelationType,
  type EntityStatus,
  type EntityType,
  type JsonRecord,
  type ProjectPlanSnapshot,
  type TaskLinkType,
  type TaskPriority
} from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { buildNodePath } from "@projectplaner/core";

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

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

function compactJson(value: JsonRecord): string {
  return JSON.stringify(value);
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

  await syncGenericEntitiesFromLegacy(db, selfPlanningSeed.project.key);
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
type EntityRow = {
  id: string;
  project_id: string;
  type: string;
  key: string | null;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  sort_order: number;
  metadata_json: string;
};
type EntityRelationV2Row = {
  id: string;
  project_id: string;
  source_entity_id: string;
  target_entity_id: string;
  type: string;
  label: string | null;
  is_primary: number;
  metadata_json: string;
};
type EntityTagAssignmentRow = {
  id: string;
  tag_id: string;
  entity_id: string;
};

function mapEntityRow(row: EntityRow): Entity {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as EntityType,
    key: row.key,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    status: row.status as EntityStatus,
    sortOrder: row.sort_order,
    metadata: parseJson(row.metadata_json, {})
  };
}

function mapEntityRelationRow(row: EntityRelationV2Row): EntityRelation {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceEntityId: row.source_entity_id,
    targetEntityId: row.target_entity_id,
    type: row.type as EntityRelationType,
    label: row.label,
    isPrimary: Boolean(row.is_primary),
    metadata: parseJson(row.metadata_json, {})
  };
}

async function getLegacyProjectSnapshot(db: DatabaseSync, key = "PLAN"): Promise<ProjectPlanSnapshot | null> {
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

function insertEntity(db: DatabaseSync, entity: Entity): void {
  run(
    db,
    `INSERT OR IGNORE INTO entities
     (id, project_id, type, key, slug, title, summary, body, status, sort_order, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entity.id,
      entity.projectId,
      entity.type,
      entity.key,
      entity.slug,
      entity.title,
      entity.summary,
      entity.body,
      entity.status,
      entity.sortOrder,
      compactJson(entity.metadata)
    ]
  );
}

function insertGenericRelation(db: DatabaseSync, relation: EntityRelation): void {
  run(
    db,
    `INSERT OR IGNORE INTO entity_relations_v2
     (id, project_id, source_entity_id, target_entity_id, type, label, is_primary, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      relation.id,
      relation.projectId,
      relation.sourceEntityId,
      relation.targetEntityId,
      relation.type,
      relation.label,
      relation.isPrimary ? 1 : 0,
      compactJson(relation.metadata)
    ]
  );
}

function genericEntityExists(db: DatabaseSync, id: string, projectId: string): boolean {
  return Boolean(db.prepare("SELECT id FROM entities WHERE id = ? AND project_id = ?").get(id, projectId));
}

function insertGenericRelationIfEndpointsExist(db: DatabaseSync, relation: EntityRelation): void {
  if (
    !genericEntityExists(db, relation.sourceEntityId, relation.projectId) ||
    !genericEntityExists(db, relation.targetEntityId, relation.projectId)
  ) {
    return;
  }

  insertGenericRelation(db, relation);
}

export async function syncGenericEntitiesFromLegacy(db: DatabaseSync, key = "PLAN"): Promise<void> {
  const snapshot = await getLegacyProjectSnapshot(db, key);
  if (!snapshot) {
    return;
  }

  for (const node of snapshot.nodes) {
    insertEntity(db, {
      id: node.id,
      projectId: node.projectId,
      type: node.type,
      key: node.type === "project" ? snapshot.project.key : null,
      slug: node.slug,
      title: node.title,
      summary: node.summary,
      body: node.body,
      status: node.status,
      sortOrder: node.sortOrder,
      metadata: { ...node.metadata, legacy: { kind: "node", parentId: node.parentId, path: node.path } }
    });
  }

  for (const feature of snapshot.features) {
    insertEntity(db, {
      id: feature.id,
      projectId: feature.projectId,
      type: "feature",
      key: feature.key,
      slug: feature.slug,
      title: feature.title,
      summary: feature.summary,
      body: feature.body,
      status: feature.status,
      sortOrder: feature.sortOrder,
      metadata: {
        ...feature.metadata,
        acceptanceShape: feature.acceptanceShape,
        legacy: { kind: "feature", parentFeatureId: feature.parentFeatureId }
      }
    });
  }

  for (const task of snapshot.tasks) {
    insertEntity(db, {
      id: task.id,
      projectId: task.projectId,
      type: "task",
      key: task.key,
      slug: slugify(task.key),
      title: task.title,
      summary: task.description,
      body: task.description,
      status: task.status,
      sortOrder: task.sortOrder,
      metadata: {
        ...task.metadata,
        priority: task.priority,
        acceptanceCriteria: task.acceptanceCriteria,
        legacy: { kind: "task" }
      }
    });
  }

  for (const node of snapshot.nodes) {
    if (node.parentId) {
      insertGenericRelationIfEndpointsExist(db, {
        id: `ger_contains_${node.parentId}_${node.id}`,
        projectId: node.projectId,
        sourceEntityId: node.parentId,
        targetEntityId: node.id,
        type: "contains",
        label: "contains",
        isPrimary: true,
        metadata: { legacy: { source: "nodes.parent_id" } }
      });
    }
  }

  for (const relation of snapshot.relations) {
    insertGenericRelationIfEndpointsExist(db, {
      id: `ger_${relation.id}`,
      projectId: relation.projectId,
      sourceEntityId: relation.sourceNodeId,
      targetEntityId: relation.targetNodeId,
      type: relation.type as EntityRelationType,
      label: relation.label,
      isPrimary: false,
      metadata: { ...relation.metadata, legacy: { source: "relations", id: relation.id } }
    });
  }

  for (const feature of snapshot.features) {
    if (feature.parentFeatureId) {
      insertGenericRelationIfEndpointsExist(db, {
        id: `ger_contains_${feature.parentFeatureId}_${feature.id}`,
        projectId: feature.projectId,
        sourceEntityId: feature.parentFeatureId,
        targetEntityId: feature.id,
        type: "contains",
        label: "contains",
        isPrimary: true,
        metadata: { legacy: { source: "features.parent_feature_id" } }
      });
    }
  }

  for (const link of snapshot.featureAspectLinks) {
    const feature = snapshot.features.find((item) => item.id === link.featureId);
    const aspect = snapshot.nodes.find((item) => item.id === link.aspectId);
    if (!feature || !aspect) {
      continue;
    }
    insertGenericRelationIfEndpointsExist(db, {
      id: `ger_${link.id}`,
      projectId: feature.projectId,
      sourceEntityId: link.featureId,
      targetEntityId: link.aspectId,
      type: link.type,
      label: null,
      isPrimary: link.isPrimary,
      metadata: { legacy: { source: "feature_aspect_links", id: link.id } }
    });
  }

  for (const link of snapshot.taskLinks) {
    const task = snapshot.tasks.find((item) => item.id === link.taskId);
    const target =
      link.targetType === "feature"
        ? snapshot.features.find((item) => item.id === link.targetId)
        : snapshot.nodes.find((item) => item.id === link.targetId);
    if (!task || !target) {
      continue;
    }
    insertGenericRelationIfEndpointsExist(db, {
      id: `ger_${link.id}`,
      projectId: task.projectId,
      sourceEntityId: link.taskId,
      targetEntityId: link.targetId,
      type: link.type,
      label: null,
      isPrimary: link.isPrimary,
      metadata: { legacy: { source: "task_links", id: link.id, targetType: link.targetType } }
    });
  }

  for (const relation of snapshot.entityRelations) {
    insertGenericRelationIfEndpointsExist(db, {
      id: `ger_${relation.id}`,
      projectId: relation.projectId,
      sourceEntityId: relation.sourceId,
      targetEntityId: relation.targetId,
      type: relation.type,
      label: relation.label,
      isPrimary: false,
      metadata: { ...relation.metadata, legacy: { source: "entity_relations", id: relation.id } }
    });
  }

  for (const assignment of snapshot.tagAssignments) {
    if (!genericEntityExists(db, assignment.targetId, snapshot.project.id)) {
      continue;
    }

    run(
      db,
      `INSERT OR IGNORE INTO entity_tag_assignments
       (id, tag_id, entity_id)
       VALUES (?, ?, ?)`,
      [`geta_${assignment.id}`, assignment.tagId, assignment.targetId]
    );
  }
}

export interface GenericProjectSnapshot {
  project: ProjectPlanSnapshot["project"];
  entities: Entity[];
  relations: EntityRelation[];
  tags: ProjectPlanSnapshot["tags"];
  tagAssignments: Array<{ id: string; tagId: string; entityId: string }>;
}

export async function getGenericProjectSnapshot(db: DatabaseSync, key = "PLAN"): Promise<GenericProjectSnapshot | null> {
  const project = db.prepare("SELECT id, key, title, description FROM projects WHERE key = ?").get(key) as
    | ProjectRow
    | undefined;

  if (!project) {
    return null;
  }

  const entityRows = db.prepare("SELECT * FROM entities WHERE project_id = ? ORDER BY sort_order ASC").all(project.id) as EntityRow[];
  const relationRows = db.prepare("SELECT * FROM entity_relations_v2 WHERE project_id = ?").all(project.id) as EntityRelationV2Row[];
  const tags = db.prepare("SELECT * FROM tags WHERE project_id = ?").all(project.id) as TagRow[];
  const tagAssignments = db
    .prepare(
      `SELECT entity_tag_assignments.* FROM entity_tag_assignments
       INNER JOIN tags ON tags.id = entity_tag_assignments.tag_id
       WHERE tags.project_id = ?`
    )
    .all(project.id) as EntityTagAssignmentRow[];

  return {
    project: {
      id: project.id,
      key: project.key,
      title: project.title,
      description: project.description
    },
    entities: entityRows.map(mapEntityRow),
    relations: relationRows.map(mapEntityRelationRow),
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
      entityId: assignment.entity_id
    }))
  };
}

function legacyPathForEntity(entity: Entity, entitiesById: Map<string, Entity>, relations: EntityRelation[]): string {
  const legacy = entity.metadata.legacy as { path?: string } | undefined;
  if (legacy?.path) {
    return legacy.path;
  }

  const primaryParent = relations.find(
    (relation) => relation.type === "contains" && relation.targetEntityId === entity.id && relation.isPrimary
  );
  const parent = primaryParent ? entitiesById.get(primaryParent.sourceEntityId) : null;
  return buildNodePath(parent ? legacyPathForEntity(parent, entitiesById, relations) : null, entity.slug);
}

function isTaskLinkRelation(source: Entity | undefined, target: Entity | undefined, relation: EntityRelation): boolean {
  return (
    source?.type === "task" &&
    (target?.type === "aspect" || target?.type === "feature") &&
    ["affects", "implements", "validates", "investigates"].includes(relation.type)
  );
}

function isFeatureAspectRelation(source: Entity | undefined, target: Entity | undefined, relation: EntityRelation): boolean {
  return (
    source?.type === "feature" &&
    target?.type === "aspect" &&
    ["affects", "implements", "validates", "investigates"].includes(relation.type)
  );
}

function toLegacySnapshot(snapshot: GenericProjectSnapshot, legacyDrafts: ProjectPlanSnapshot | null): ProjectPlanSnapshot {
  const byId = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const nodeEntities = snapshot.entities.filter((entity) => entity.type !== "feature" && entity.type !== "task");
  const featureEntities = snapshot.entities.filter((entity) => entity.type === "feature");
  const taskEntities = snapshot.entities.filter((entity) => entity.type === "task");
  const parentByTarget = new Map(
    snapshot.relations
      .filter((relation) => relation.type === "contains" && relation.isPrimary)
      .map((relation) => [relation.targetEntityId, relation.sourceEntityId])
  );

  return {
    project: snapshot.project,
    nodes: nodeEntities.map((entity) => ({
      id: entity.id,
      projectId: entity.projectId,
      parentId: parentByTarget.get(entity.id) ?? null,
      type: entity.type as ProjectPlanSnapshot["nodes"][number]["type"],
      slug: entity.slug,
      path: legacyPathForEntity(entity, byId, snapshot.relations),
      title: entity.title,
      summary: entity.summary,
      body: entity.body,
      status: entity.status as ProjectPlanSnapshot["nodes"][number]["status"],
      sortOrder: entity.sortOrder,
      metadata: entity.metadata
    })),
    relations: snapshot.relations
      .filter((relation) => {
        const source = byId.get(relation.sourceEntityId);
        const target = byId.get(relation.targetEntityId);
        return (
          relation.type !== "contains" &&
          source &&
          target &&
          source.type !== "feature" &&
          source.type !== "task" &&
          target.type !== "feature" &&
          target.type !== "task"
        );
      })
      .map((relation) => ({
        id: relation.id,
        projectId: relation.projectId,
        sourceNodeId: relation.sourceEntityId,
        targetNodeId: relation.targetEntityId,
        type: relation.type as ProjectPlanSnapshot["relations"][number]["type"],
        label: relation.label,
        metadata: relation.metadata
      })),
    draftPlans: legacyDrafts?.draftPlans ?? [],
    draftChanges: legacyDrafts?.draftChanges ?? [],
    features: featureEntities.map((entity) => ({
      id: entity.id,
      projectId: entity.projectId,
      parentFeatureId: parentByTarget.get(entity.id) ?? null,
      key: entity.key ?? entity.slug,
      slug: entity.slug,
      title: entity.title,
      summary: entity.summary,
      body: entity.body,
      status: entity.status as ProjectPlanSnapshot["features"][number]["status"],
      acceptanceShape: typeof entity.metadata.acceptanceShape === "string" ? entity.metadata.acceptanceShape : "",
      sortOrder: entity.sortOrder,
      metadata: entity.metadata
    })),
    featureAspectLinks: snapshot.relations
      .filter((relation) => isFeatureAspectRelation(byId.get(relation.sourceEntityId), byId.get(relation.targetEntityId), relation))
      .map((relation) => ({
        id: relation.id,
        featureId: relation.sourceEntityId,
        aspectId: relation.targetEntityId,
        type: relation.type as TaskLinkType,
        isPrimary: relation.isPrimary
      })),
    tasks: taskEntities.map((entity) => ({
      id: entity.id,
      projectId: entity.projectId,
      key: entity.key ?? entity.slug,
      title: entity.title,
      description: entity.body || entity.summary,
      status: entity.status as ProjectPlanSnapshot["tasks"][number]["status"],
      priority: (typeof entity.metadata.priority === "string" ? entity.metadata.priority : "medium") as TaskPriority,
      acceptanceCriteria: Array.isArray(entity.metadata.acceptanceCriteria)
        ? entity.metadata.acceptanceCriteria.filter((item): item is string => typeof item === "string")
        : [],
      sortOrder: entity.sortOrder,
      metadata: entity.metadata
    })),
    taskLinks: snapshot.relations
      .filter((relation) => isTaskLinkRelation(byId.get(relation.sourceEntityId), byId.get(relation.targetEntityId), relation))
      .map((relation) => ({
        id: relation.id,
        taskId: relation.sourceEntityId,
        targetType: byId.get(relation.targetEntityId)?.type === "feature" ? "feature" : "aspect",
        targetId: relation.targetEntityId,
        type: relation.type as TaskLinkType,
        isPrimary: relation.isPrimary
      })),
    entityRelations: snapshot.relations
      .filter((relation) => {
        const source = byId.get(relation.sourceEntityId);
        const target = byId.get(relation.targetEntityId);
        return (
          relation.type !== "contains" &&
          !isTaskLinkRelation(source, target, relation) &&
          !isFeatureAspectRelation(source, target, relation) &&
          source &&
          target
        );
      })
      .map((relation) => ({
        id: relation.id,
        projectId: relation.projectId,
        sourceType: byId.get(relation.sourceEntityId)?.type ?? "reference",
        sourceId: relation.sourceEntityId,
        targetType: byId.get(relation.targetEntityId)?.type ?? "reference",
        targetId: relation.targetEntityId,
        type: relation.type,
        label: relation.label,
        metadata: relation.metadata
      })),
    tags: snapshot.tags,
    tagAssignments: snapshot.tagAssignments.map((assignment) => {
      const entity = byId.get(assignment.entityId);
      return {
        id: assignment.id,
        tagId: assignment.tagId,
        targetType: entity?.type ?? "reference",
        targetId: assignment.entityId
      };
    })
  };
}

async function getProjectSnapshotFromLegacyTables(db: DatabaseSync, key = "PLAN"): Promise<ProjectPlanSnapshot | null> {
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

export async function getProjectSnapshot(db: DatabaseSync, key = "PLAN"): Promise<ProjectPlanSnapshot | null> {
  const generic = await getGenericProjectSnapshot(db, key);
  const legacy = await getProjectSnapshotFromLegacyTables(db, key);

  if (!generic || generic.entities.length === 0) {
    return legacy;
  }

  return toLegacySnapshot(generic, legacy);
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

  insertEntity(db, {
    id,
    projectId: project.id,
    type: "task",
    key,
    slug: slugify(key),
    title,
    summary: input.description.trim(),
    body: input.description.trim(),
    status: "todo",
    sortOrder: nextNumber,
    metadata: {
      priority: input.priority,
      acceptanceCriteria: input.acceptanceCriteria.filter(Boolean),
      legacy: { kind: "task" }
    }
  });
  insertGenericRelation(db, {
    id: `ger_tl_${randomUUID()}`,
    projectId: project.id,
    sourceEntityId: id,
    targetEntityId: input.targetId,
    type: input.linkType,
    label: null,
    isPrimary: true,
    metadata: { createdBy: "createTask", targetType: input.targetType }
  });

  return { id, key };
}

export interface CreateEntityInput {
  projectKey: string;
  type: EntityType;
  title: string;
  key?: string | null;
  slug?: string;
  summary?: string;
  body?: string;
  status?: EntityStatus;
  sortOrder?: number;
  metadata?: JsonRecord;
  relations?: Array<{
    targetEntityId: string;
    type: EntityRelationType;
    label?: string | null;
    isPrimary?: boolean;
    metadata?: JsonRecord;
  }>;
}

export interface UpdateEntityInput {
  id: string;
  patch: Partial<Pick<Entity, "key" | "slug" | "title" | "summary" | "body" | "status" | "sortOrder" | "metadata">>;
}

export interface EntityQuery {
  projectKey?: string;
  type?: EntityType;
  query?: string;
}

export interface CreateRelationInput {
  projectKey?: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: EntityRelationType;
  label?: string | null;
  isPrimary?: boolean;
  metadata?: JsonRecord;
}

export interface UpdateRelationInput {
  id: string;
  patch: Partial<Pick<EntityRelation, "type" | "label" | "isPrimary" | "metadata">>;
}

function getProjectByKey(db: DatabaseSync, key = "PLAN"): ProjectRow {
  const project = db.prepare("SELECT id, key, title, description FROM projects WHERE key = ?").get(key) as ProjectRow | undefined;
  if (!project) {
    throw new Error("Project not found.");
  }
  return project;
}

function getEntityRowsForProject(db: DatabaseSync, projectId: string): Entity[] {
  return (db.prepare("SELECT * FROM entities WHERE project_id = ? ORDER BY sort_order ASC").all(projectId) as EntityRow[]).map(
    mapEntityRow
  );
}

function getRelationRowsForProject(db: DatabaseSync, projectId: string): EntityRelation[] {
  return (db.prepare("SELECT * FROM entity_relations_v2 WHERE project_id = ?").all(projectId) as EntityRelationV2Row[]).map(
    mapEntityRelationRow
  );
}

function assertValidProjectGraph(db: DatabaseSync, projectId: string): string[] {
  const result = validateEntityGraph(getEntityRowsForProject(db, projectId), getRelationRowsForProject(db, projectId));
  if (result.errors.length > 0) {
    throw new Error(result.errors.join(" "));
  }
  return result.warnings;
}

function nextEntityKey(db: DatabaseSync, project: ProjectRow, prefix: string): string {
  const rows = db.prepare("SELECT key FROM entities WHERE project_id = ? AND key IS NOT NULL").all(project.id) as { key: string }[];
  const nextNumber =
    rows.reduce((max, row) => {
      const match = row.key.match(new RegExp(`^${prefix}-(\\d+)$`));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
  return `${prefix}-${nextNumber}`;
}

export async function createEntity(db: DatabaseSync, input: CreateEntityInput): Promise<{ entity: Entity; warnings: string[] }> {
  const project = getProjectByKey(db, input.projectKey);
  const title = input.title.trim();
  if (!title) {
    throw new Error("Entity title is required.");
  }

  const id = `${input.type}_${randomUUID()}`;
  const key =
    input.key === undefined && input.type === "task"
      ? nextEntityKey(db, project, project.key)
      : input.key === undefined && input.type === "feature"
        ? nextEntityKey(db, project, "FEAT")
        : input.key ?? null;
  const entity: Entity = {
    id,
    projectId: project.id,
    type: input.type,
    key,
    slug: input.slug ? slugify(input.slug) : slugify(key ?? title),
    title,
    summary: input.summary?.trim() ?? "",
    body: input.body?.trim() ?? "",
    status: input.status ?? (input.type === "task" ? "todo" : "planned"),
    sortOrder:
      input.sortOrder ??
      ((db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM entities WHERE project_id = ?").get(project.id) as {
        max_sort: number;
      }).max_sort + 1),
    metadata: input.metadata ?? {}
  };

  db.exec("BEGIN");
  try {
    insertEntity(db, entity);
    for (const relation of input.relations ?? []) {
      const target = db.prepare("SELECT id FROM entities WHERE id = ? AND project_id = ?").get(relation.targetEntityId, project.id);
      if (!target) {
        throw new Error(`Relation target ${relation.targetEntityId} does not exist.`);
      }
      insertGenericRelation(db, {
        id: `ger_${randomUUID()}`,
        projectId: project.id,
        sourceEntityId: entity.id,
        targetEntityId: relation.targetEntityId,
        type: relation.type,
        label: relation.label ?? null,
        isPrimary: relation.isPrimary ?? false,
        metadata: relation.metadata ?? {}
      });
    }
    const warnings = assertValidProjectGraph(db, project.id);
    db.exec("COMMIT");
    return { entity, warnings };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function updateEntity(db: DatabaseSync, input: UpdateEntityInput): Promise<Entity> {
  const current = await getEntity(db, input.id);
  if (!current) {
    throw new Error("Entity not found.");
  }

  const next: Entity = {
    ...current,
    ...input.patch,
    key: input.patch.key === undefined ? current.key : input.patch.key,
    metadata: input.patch.metadata === undefined ? current.metadata : input.patch.metadata
  };

  run(
    db,
    `UPDATE entities
     SET key = ?, slug = ?, title = ?, summary = ?, body = ?, status = ?, sort_order = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      next.key,
      next.slug,
      next.title,
      next.summary,
      next.body,
      next.status,
      next.sortOrder,
      compactJson(next.metadata),
      next.id
    ]
  );
  assertValidProjectGraph(db, next.projectId);
  return next;
}

export async function deleteEntity(db: DatabaseSync, id: string): Promise<void> {
  const entity = await getEntity(db, id);
  if (!entity) {
    throw new Error("Entity not found.");
  }

  db.exec("BEGIN");
  try {
    run(db, "DELETE FROM entities WHERE id = ?", [id]);
    assertValidProjectGraph(db, entity.projectId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function getEntity(db: DatabaseSync, id: string): Promise<Entity | null> {
  const row = db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as EntityRow | undefined;
  return row ? mapEntityRow(row) : null;
}

export async function listEntities(db: DatabaseSync, query: EntityQuery = {}): Promise<Entity[]> {
  const values: string[] = [];
  let sql = "SELECT entities.* FROM entities INNER JOIN projects ON projects.id = entities.project_id WHERE 1 = 1";
  if (query.projectKey) {
    sql += " AND projects.key = ?";
    values.push(query.projectKey);
  }
  if (query.type) {
    sql += " AND entities.type = ?";
    values.push(query.type);
  }
  if (query.query) {
    sql += " AND (entities.title LIKE ? OR entities.slug LIKE ? OR entities.summary LIKE ? OR entities.body LIKE ?)";
    const pattern = `%${query.query}%`;
    values.push(pattern, pattern, pattern, pattern);
  }
  sql += " ORDER BY entities.sort_order ASC";
  return (db.prepare(sql).all(...values) as EntityRow[]).map(mapEntityRow);
}

export async function createRelation(db: DatabaseSync, input: CreateRelationInput): Promise<EntityRelation> {
  const source = await getEntity(db, input.sourceEntityId);
  const target = await getEntity(db, input.targetEntityId);
  if (!source || !target || source.projectId !== target.projectId) {
    throw new Error("Relation endpoints must exist in the same project.");
  }
  if (input.projectKey) {
    getProjectByKey(db, input.projectKey);
  }

  const relation: EntityRelation = {
    id: `ger_${randomUUID()}`,
    projectId: source.projectId,
    sourceEntityId: source.id,
    targetEntityId: target.id,
    type: input.type,
    label: input.label ?? null,
    isPrimary: input.isPrimary ?? false,
    metadata: input.metadata ?? {}
  };

  db.exec("BEGIN");
  try {
    insertGenericRelation(db, relation);
    assertValidProjectGraph(db, relation.projectId);
    db.exec("COMMIT");
    return relation;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function updateRelation(db: DatabaseSync, input: UpdateRelationInput): Promise<EntityRelation> {
  const current = (db.prepare("SELECT * FROM entity_relations_v2 WHERE id = ?").get(input.id) as EntityRelationV2Row | undefined);
  if (!current) {
    throw new Error("Relation not found.");
  }
  const next: EntityRelation = { ...mapEntityRelationRow(current), ...input.patch };
  run(
    db,
    `UPDATE entity_relations_v2
     SET type = ?, label = ?, is_primary = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [next.type, next.label, next.isPrimary ? 1 : 0, compactJson(next.metadata), next.id]
  );
  assertValidProjectGraph(db, next.projectId);
  return next;
}

export async function deleteRelation(db: DatabaseSync, id: string): Promise<void> {
  const current = db.prepare("SELECT * FROM entity_relations_v2 WHERE id = ?").get(id) as EntityRelationV2Row | undefined;
  if (!current) {
    throw new Error("Relation not found.");
  }
  db.exec("BEGIN");
  try {
    run(db, "DELETE FROM entity_relations_v2 WHERE id = ?", [id]);
    assertValidProjectGraph(db, current.project_id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function listRelations(
  db: DatabaseSync,
  query: { projectKey?: string; sourceEntityId?: string; targetEntityId?: string; type?: EntityRelationType } = {}
): Promise<EntityRelation[]> {
  const values: string[] = [];
  let sql =
    "SELECT entity_relations_v2.* FROM entity_relations_v2 INNER JOIN projects ON projects.id = entity_relations_v2.project_id WHERE 1 = 1";
  if (query.projectKey) {
    sql += " AND projects.key = ?";
    values.push(query.projectKey);
  }
  if (query.sourceEntityId) {
    sql += " AND entity_relations_v2.source_entity_id = ?";
    values.push(query.sourceEntityId);
  }
  if (query.targetEntityId) {
    sql += " AND entity_relations_v2.target_entity_id = ?";
    values.push(query.targetEntityId);
  }
  if (query.type) {
    sql += " AND entity_relations_v2.type = ?";
    values.push(query.type);
  }
  return (db.prepare(sql).all(...values) as EntityRelationV2Row[]).map(mapEntityRelationRow);
}

export interface GenericPlanExport {
  project: ProjectPlanSnapshot["project"];
  entities: Entity[];
  relations: EntityRelation[];
  tags: ProjectPlanSnapshot["tags"];
  tagAssignments: Array<{ id: string; tagId: string; entityId: string }>;
}

export async function exportGenericPlan(db: DatabaseSync, key = "PLAN"): Promise<GenericPlanExport> {
  const snapshot = await getGenericProjectSnapshot(db, key);
  if (!snapshot) {
    throw new Error("Project not found.");
  }
  return snapshot;
}

export async function importGenericPlan(db: DatabaseSync, input: GenericPlanExport): Promise<void> {
  run(db, "INSERT OR IGNORE INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)", [
    input.project.id,
    input.project.key,
    input.project.title,
    input.project.description
  ]);

  db.exec("BEGIN");
  try {
    run(db, "DELETE FROM entity_tag_assignments WHERE entity_id IN (SELECT id FROM entities WHERE project_id = ?)", [input.project.id]);
    run(db, "DELETE FROM entity_relations_v2 WHERE project_id = ?", [input.project.id]);
    run(db, "DELETE FROM entities WHERE project_id = ?", [input.project.id]);

    for (const entity of input.entities) {
      insertEntity(db, entity);
    }
    for (const relation of input.relations) {
      insertGenericRelation(db, relation);
    }
    for (const tag of input.tags) {
      run(db, "INSERT OR IGNORE INTO tags (id, project_id, slug, label, kind) VALUES (?, ?, ?, ?, ?)", [
        tag.id,
        tag.projectId,
        tag.slug,
        tag.label,
        tag.kind
      ]);
    }
    for (const assignment of input.tagAssignments) {
      run(db, "INSERT OR IGNORE INTO entity_tag_assignments (id, tag_id, entity_id) VALUES (?, ?, ?)", [
        assignment.id,
        assignment.tagId,
        assignment.entityId
      ]);
    }
    assertValidProjectGraph(db, input.project.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
