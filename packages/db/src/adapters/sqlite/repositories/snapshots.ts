import type { Entity, EntityRelation, ProjectPlanSnapshot, TaskLinkType, TaskPriority } from "@projectplaner/core";
import domain from "@projectplaner/core/domain";

const { buildNodePath } = domain;
import type { DatabaseSync } from "node:sqlite";
import {
  insertEntity,
  insertGenericRelation,
  mapEntityRelationRow,
  mapEntityRow,
  parseJson,
  run,
  type EntityRelationV2Row,
  type EntityRow,
  type EntityTagAssignmentRow,
  type ProjectRow,
  type TagRow
} from "../storage/index";
import { assertValidProjectGraph } from "./graph";

import type { GenericProjectSnapshot } from "../../../contracts/snapshots";
export type { GenericProjectSnapshot } from "../../../contracts/snapshots";

import type { GenericPlanExport } from "../../../contracts/snapshots";
export type { GenericPlanExport } from "../../../contracts/snapshots";

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
type TagAssignmentRow = {
  id: string;
  tag_id: string;
  target_type: string;
  target_id: string;
};

async function getGeneric(
  db: DatabaseSync,
  key = "PLAN",
  options: { includeArchived?: boolean } = {}
): Promise<GenericProjectSnapshot | null> {
  const project = db.prepare("SELECT id, key, title, description FROM projects WHERE key = ?").get(key) as
    | ProjectRow
    | undefined;

  if (!project) {
    return null;
  }

  const includeArchived = options.includeArchived === true;
  const entityRows = (
    includeArchived
      ? (db.prepare("SELECT * FROM entities WHERE project_id = ? ORDER BY sort_order ASC").all(project.id) as EntityRow[])
      : (db
          .prepare("SELECT * FROM entities WHERE project_id = ? AND status != ? ORDER BY sort_order ASC")
          .all(project.id, "archived") as EntityRow[])
  );
  const entities = entityRows.map(mapEntityRow);
  const activeIds = new Set(entities.map((entity) => entity.id));

  const relationRows = db.prepare("SELECT * FROM entity_relations_v2 WHERE project_id = ?").all(project.id) as EntityRelationV2Row[];
  const relations = relationRows
    .map(mapEntityRelationRow)
    .filter(
      (relation) => includeArchived || (activeIds.has(relation.sourceEntityId) && activeIds.has(relation.targetEntityId))
    );

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
    entities,
    relations,
    tags: tags.map((tag) => ({
      id: tag.id,
      projectId: tag.project_id,
      slug: tag.slug,
      label: tag.label,
      kind: tag.kind as ProjectPlanSnapshot["tags"][number]["kind"]
    })),
    tagAssignments: tagAssignments
      .filter((assignment) => includeArchived || activeIds.has(assignment.entity_id))
      .map((assignment) => ({
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

  const nodes = db.prepare("SELECT * FROM nodes WHERE project_id = ? ORDER BY sort_order ASC").all(project.id) as NodeRow[];
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

async function get(
  db: DatabaseSync,
  key = "PLAN",
  options: { includeArchived?: boolean } = {}
): Promise<ProjectPlanSnapshot | null> {
  const generic = await getGeneric(db, key, options);
  const legacy = await getProjectSnapshotFromLegacyTables(db, key);

  if (!generic || generic.entities.length === 0) {
    return legacy;
  }

  return toLegacySnapshot(generic, legacy);
}

async function exportPlan(db: DatabaseSync, key = "PLAN"): Promise<GenericPlanExport> {
  const snapshot = await getGeneric(db, key);
  if (!snapshot) {
    throw new Error("Project not found.");
  }
  return snapshot;
}

async function importPlan(db: DatabaseSync, input: GenericPlanExport): Promise<void> {
  run(db, "INSERT OR IGNORE INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)", [
    input.project.id,
    input.project.key,
    input.project.title,
    input.project.description
  ]);

  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    run(db, "DELETE FROM entity_tag_assignments WHERE entity_id IN (SELECT id FROM entities WHERE project_id = ?)", [
      input.project.id
    ]);
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
    if (ownsTransaction) db.exec("COMMIT");
  } catch (error) {
    if (ownsTransaction && db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

const snapshots = {
  get,
  getGeneric,
  export: exportPlan,
  import: importPlan
};

export default snapshots;
